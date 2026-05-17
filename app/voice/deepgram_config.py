import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class DeepgramConfig:
    api_key: str
    stt_model: str
    stt_language: str
    tts_model: str
    tts_encoding: str
    ws_base_url: str
    endpointing_ms: int
    utterance_end_ms: int
    keepalive_seconds: float
    connect_retries: int
    connect_retry_delay: float
    reconnect_base_cooldown: float
    reconnect_max_cooldown: float
    sample_rate: int = 16000

    @classmethod
    def from_env(cls) -> "DeepgramConfig":
        return cls(
            api_key=os.getenv("DEEPGRAM_API_KEY", "").strip(),
            stt_model=os.getenv("DEEPGRAM_STT_MODEL", "nova-2-general"),
            stt_language=os.getenv("DEEPGRAM_STT_LANGUAGE", "multi"),
            tts_model=os.getenv("DEEPGRAM_TTS_MODEL", "aura-2-thalia-en"),
            tts_encoding=os.getenv("DEEPGRAM_TTS_ENCODING", "mp3"),
            ws_base_url=os.getenv(
                "DEEPGRAM_WS_BASE_URL", "wss://api.deepgram.com/v1/listen"
            ),
            endpointing_ms=_env_int("DEEPGRAM_REALTIME_ENDPOINTING_MS", 400),
            utterance_end_ms=_env_int("DEEPGRAM_UTTERANCE_END_MS", 1200),
            keepalive_seconds=_env_float("DEEPGRAM_STREAM_KEEPALIVE_SECONDS", 4.0),
            connect_retries=_env_int("DEEPGRAM_CONNECT_RETRIES", 3),
            connect_retry_delay=_env_float(
                "DEEPGRAM_CONNECT_RETRY_DELAY_SECONDS", 1.0
            ),
            reconnect_base_cooldown=_env_float(
                "DEEPGRAM_RECONNECT_BASE_COOLDOWN_SECONDS", 2.0
            ),
            reconnect_max_cooldown=_env_float(
                "DEEPGRAM_RECONNECT_MAX_COOLDOWN_SECONDS", 20.0
            ),
        )

    def validate(self) -> None:
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not set in backend/.env")
