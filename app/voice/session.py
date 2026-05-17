import asyncio
import logging
import time
from enum import Enum

from fastapi import WebSocket

from app.models.schemas import ChatRequest
from app.services.chat_orchestrator import (
    messages_from_voice_history,
    process_chat,
)
from app.services.chat_service import is_actionable_utterance
from app.voice.deepgram_stt import DeepgramRealtimeSTT
from app.voice.deepgram_tts import DeepgramTTS
from app.voice.messages import (
    chat_response_message,
    error_message,
    status_message,
    transcript_message,
    wake_word_message,
)
from app.voice.text_utils import plain_speech_text
from app.voice.wake_word import detect_wake_word, strip_wake_word

logger = logging.getLogger(__name__)

# Seconds to ignore mic/STT after assistant speaks (prevents hearing its own voice).
POST_TTS_COOLDOWN_SEC = 0.35
BARGE_IN_MIN_WORDS = 3

GREETING = (
    "Hi! Tell me the role you're hiring for and what you'd like to assess—for example, "
    "a senior Java developer who works with stakeholders."
)


class SessionMode(str, Enum):
    ACTIVE = "active"
    PROCESSING = "processing"


class VoiceSession:
    """Manages one browser WebSocket voice connection."""

    def __init__(self, websocket: WebSocket) -> None:
        self.websocket = websocket
        self.mode = SessionMode.ACTIVE
        self.committed_transcript = ""
        self.interim_transcript = ""
        self.conversation_history: list[dict] = []
        self.stt: DeepgramRealtimeSTT | None = None
        self.tts = DeepgramTTS()
        self._processing = False
        self._tts_active = False
        self._greeted = False
        self._tts_task: asyncio.Task | None = None
        self._listen_blocked_until = 0.0

    def _mic_allowed(self) -> bool:
        return time.monotonic() >= self._listen_blocked_until

    def _block_listen_for(self, seconds: float) -> None:
        self._listen_blocked_until = max(
            self._listen_blocked_until,
            time.monotonic() + seconds,
        )

    async def start_stt(self) -> None:
        try:
            self.stt = DeepgramRealtimeSTT(
                on_transcript=self._handle_transcript,
                on_utterance_end=self._handle_utterance_end,
            )
            await self.stt.start()
            await self.websocket.send_text(
                status_message(stt_ready=True, mode=self.mode.value)
            )
        except Exception as exc:
            self.stt = None
            await self.websocket.send_text(
                error_message(
                    f"Speech recognition failed: {exc}. "
                    "Check DEEPGRAM_API_KEY and model settings in backend/.env"
                )
            )
            await self.websocket.send_text(status_message(stt_ready=False))

    async def stop_stt(self) -> None:
        if self.stt:
            await self.stt.close()
            self.stt = None
        await self.websocket.send_text(status_message(stt_ready=False))

    async def handle_audio(self, chunk: bytes) -> None:
        # Keep streaming during TTS so the user can interrupt (barge-in).
        if self.stt and not self._processing:
            await self.stt.send_audio(chunk)

    async def handle_control(self, msg: dict) -> None:
        msg_type = msg.get("type")

        if msg_type == "start_listening":
            self.mode = SessionMode.ACTIVE
            if not self.conversation_history:
                self._reset_transcripts()
            if not self.stt:
                try:
                    await self.start_stt()
                except Exception:
                    return
            if not self._greeted:
                await self._send_greeting()
            await self.websocket.send_text(
                status_message(mode=self.mode.value, listening=True)
            )
            return

        if msg_type == "stop_listening":
            if self._tts_task and not self._tts_task.done():
                self._tts_task.cancel()
            await self.stop_stt()
            await self.websocket.send_text(status_message(listening=False))
            return

        if msg_type == "reset":
            self.conversation_history.clear()
            self.mode = SessionMode.ACTIVE
            self._greeted = False
            self._reset_transcripts()
            await self.websocket.send_text(
                status_message(mode=self.mode.value, reset=True)
            )

    async def _send_greeting(self) -> None:
        """Text-only greeting in chat — no TTS (avoids echo while mic opens)."""
        self._greeted = True
        self.conversation_history.append(
            {"role": "assistant", "content": GREETING}
        )
        await self.websocket.send_text(
            chat_response_message(
                reply=GREETING,
                recommendations=[],
                end_of_conversation=False,
                greeting=True,
            )
        )

    async def _emit_transcript(self) -> None:
        await self.websocket.send_text(
            transcript_message(
                committed=self.committed_transcript,
                interim=self.interim_transcript,
            )
        )

    async def _interrupt_tts(self) -> None:
        if self._tts_task and not self._tts_task.done():
            self._tts_task.cancel()
            try:
                await self._tts_task
            except asyncio.CancelledError:
                pass
        self._tts_active = False
        await self.websocket.send_text(
            status_message(tts_playing=False, tts_interrupted=True)
        )

    async def _handle_transcript(self, text: str, is_final: bool) -> None:
        if self._tts_active and is_final:
            words = text.split()
            if len(words) >= BARGE_IN_MIN_WORDS:
                await self._interrupt_tts()

        if self._processing:
            return

        if is_final:
            self.committed_transcript = (
                f"{self.committed_transcript} {text}".strip()
            )
            self.interim_transcript = ""
        else:
            self.interim_transcript = text

        await self._emit_transcript()

        if detect_wake_word(text):
            await self.websocket.send_text(wake_word_message(detected=True))

    async def _handle_utterance_end(self) -> None:
        if self._processing or self._tts_active or not self._mic_allowed():
            return

        utterance = self._normalized_utterance(self._current_utterance())
        if not is_actionable_utterance(utterance):
            logger.info("Ignored non-actionable utterance: %r", utterance)
            self._reset_transcripts()
            return

        asyncio.create_task(self._run_chat_pipeline(utterance=utterance))

    def _current_utterance(self) -> str:
        return f"{self.committed_transcript} {self.interim_transcript}".strip()

    def _normalized_utterance(self, text: str) -> str:
        return strip_wake_word(text).strip()

    async def _run_chat_pipeline(self, utterance: str | None = None) -> None:
        raw = (utterance or self._current_utterance()).strip()
        text = self._normalized_utterance(raw)

        if not text or self._processing:
            return

        if not is_actionable_utterance(text):
            self._reset_transcripts()
            return

        self._processing = True
        self.mode = SessionMode.PROCESSING
        self._block_listen_for(POST_TTS_COOLDOWN_SEC)
        await self.websocket.send_text(status_message(processing=True))

        try:
            messages = messages_from_voice_history(
                self.conversation_history,
                text,
            )
            response = await asyncio.to_thread(
                lambda: process_chat(
                    ChatRequest(messages=messages),
                    for_voice=True,
                ),
            )

            self.conversation_history.append({"role": "user", "content": text})
            self.conversation_history.append(
                {"role": "assistant", "content": response.reply}
            )

            recs = [r.model_dump() for r in response.recommendations]
            await self.websocket.send_text(
                chat_response_message(
                    reply=response.reply,
                    recommendations=recs,
                    end_of_conversation=response.end_of_conversation,
                    user_message=text,
                )
            )

            self._tts_task = asyncio.create_task(self._speak_once(response.reply))
            await self._tts_task
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Chat pipeline failed")
            await self.websocket.send_text(
                error_message(f"Chat processing failed: {exc}")
            )
        finally:
            self._reset_transcripts()
            self._processing = False
            self.mode = SessionMode.ACTIVE
            self._block_listen_for(POST_TTS_COOLDOWN_SEC)
            await self.websocket.send_text(
                status_message(
                    processing=False,
                    listening=True,
                    mode=self.mode.value,
                    ready_for_next=True,
                )
            )

    async def _speak_once(self, text: str) -> None:
        """One complete MP3 per reply — avoids crackling from partial MP3 chunks."""
        spoken = plain_speech_text(text)
        self._tts_active = True
        self._reset_transcripts()
        await self.websocket.send_text(status_message(tts_playing=True))
        try:
            audio = await self.tts.synthesize(spoken)
            if audio:
                await self.websocket.send_bytes(audio)
        except Exception as exc:
            await self.websocket.send_text(error_message(f"TTS failed: {exc}"))
        finally:
            self._tts_active = False
            self._block_listen_for(POST_TTS_COOLDOWN_SEC)
            await self.websocket.send_text(status_message(tts_playing=False))

    def _reset_transcripts(self) -> None:
        self.committed_transcript = ""
        self.interim_transcript = ""

    async def close(self) -> None:
        if self._tts_task and not self._tts_task.done():
            self._tts_task.cancel()
        await self.stop_stt()
