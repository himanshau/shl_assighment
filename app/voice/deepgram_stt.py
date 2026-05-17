import asyncio
import json
import logging
import urllib.parse
from collections.abc import Awaitable, Callable

import websockets
from websockets.asyncio.client import connect as ws_connect

from app.voice.deepgram_config import DeepgramConfig

logger = logging.getLogger(__name__)

TranscriptCallback = Callable[[str, bool], Awaitable[None] | None]
UtteranceEndCallback = Callable[[], Awaitable[None] | None]


class DeepgramRealtimeSTT:
    """
    Raw WebSocket STT client (bypasses Deepgram SDK listen WS).

    The Deepgram SDK v6 passes extra_headers= but websockets>=16 requires
    additional_headers=, which caused HTTP 400. Raw WS is reliable here.
    """

    def __init__(
        self,
        on_transcript: TranscriptCallback,
        on_utterance_end: UtteranceEndCallback | None = None,
        *,
        config: DeepgramConfig | None = None,
    ) -> None:
        self._config = config or DeepgramConfig.from_env()
        self._on_transcript = on_transcript
        self._on_utterance_end = on_utterance_end
        self._ws = None
        self._listen_task: asyncio.Task | None = None
        self._keepalive_task: asyncio.Task | None = None
        self._ready = asyncio.Event()

    @property
    def is_ready(self) -> bool:
        return self._ready.is_set()

    def _build_url(self) -> str:
        params = {
            "model": self._config.stt_model,
            "language": self._config.stt_language,
            "encoding": "linear16",
            "sample_rate": str(self._config.sample_rate),
            "channels": "1",
            "interim_results": "true",
            "punctuate": "true",
            "smart_format": "true",
            "endpointing": str(self._config.endpointing_ms),
            "utterance_end_ms": str(self._config.utterance_end_ms),
            "vad_events": "true",
        }
        base = self._config.ws_base_url.rstrip("/")
        return f"{base}?{urllib.parse.urlencode(params)}"

    async def start(self) -> None:
        self._config.validate()
        last_error: Exception | None = None

        for attempt in range(self._config.connect_retries):
            try:
                await self._open_connection()
                logger.info(
                    "Deepgram STT connected (model=%s, language=%s)",
                    self._config.stt_model,
                    self._config.stt_language,
                )
                return
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Deepgram connect attempt %s/%s failed: %s",
                    attempt + 1,
                    self._config.connect_retries,
                    exc,
                )
                await self._cleanup()
                if attempt < self._config.connect_retries - 1:
                    delay = self._config.connect_retry_delay * (2**attempt)
                    await asyncio.sleep(delay)

        raise RuntimeError(
            f"Deepgram STT failed after {self._config.connect_retries} attempts: {last_error}"
        ) from last_error

    async def _open_connection(self) -> None:
        url = self._build_url()
        headers = {"Authorization": f"Token {self._config.api_key}"}

        self._ws = await ws_connect(
            url,
            additional_headers=headers,
            open_timeout=15,
        )
        self._listen_task = asyncio.create_task(self._receive_loop())
        self._keepalive_task = asyncio.create_task(self._keepalive_loop())
        self._ready.set()

    async def _receive_loop(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                if isinstance(raw, bytes):
                    continue
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                await self._handle_message(data)
        except websockets.ConnectionClosed:
            logger.info("Deepgram STT connection closed")
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Deepgram receive error: %s", exc)

    async def _handle_message(self, data: dict) -> None:
        msg_type = data.get("type", "")

        if msg_type == "Results":
            channel = data.get("channel", {})
            alts = channel.get("alternatives", [])
            transcript = alts[0].get("transcript", "") if alts else ""
            is_final = bool(data.get("is_final") or data.get("speech_final"))
            if transcript.strip():
                await self._emit_transcript(transcript.strip(), is_final)

        elif msg_type == "UtteranceEnd":
            await self._emit_utterance_end()

        elif msg_type == "Metadata":
            logger.debug("Deepgram metadata: %s", data.get("request_id"))

        elif msg_type == "Error":
            logger.error("Deepgram error message: %s", data)

    async def _keepalive_loop(self) -> None:
        while self._ws:
            await asyncio.sleep(self._config.keepalive_seconds)
            try:
                await self._ws.send(json.dumps({"type": "KeepAlive"}))
            except Exception:
                break

    async def send_audio(self, chunk: bytes) -> None:
        if self._ws:
            await self._ws.send(chunk)

    async def finalize(self) -> None:
        if self._ws:
            await self._ws.send(json.dumps({"type": "Finalize"}))

    async def close(self) -> None:
        self._ready.clear()
        if self._ws:
            try:
                await self._ws.send(json.dumps({"type": "CloseStream"}))
            except Exception:
                pass
        await self._cleanup()
        logger.info("Deepgram STT closed")

    async def _cleanup(self) -> None:
        if self._keepalive_task and not self._keepalive_task.done():
            self._keepalive_task.cancel()
            try:
                await self._keepalive_task
            except asyncio.CancelledError:
                pass
        self._keepalive_task = None

        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
        self._listen_task = None

        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
        self._ws = None

    async def _emit_transcript(self, text: str, is_final: bool) -> None:
        result = self._on_transcript(text, is_final)
        if asyncio.iscoroutine(result):
            await result

    async def _emit_utterance_end(self) -> None:
        if not self._on_utterance_end:
            return
        result = self._on_utterance_end()
        if asyncio.iscoroutine(result):
            await result
