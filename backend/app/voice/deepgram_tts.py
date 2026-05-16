from collections.abc import AsyncIterator

from deepgram import AsyncDeepgramClient

from app.voice.deepgram_config import DeepgramConfig


class DeepgramTTS:
    """Generates speech via Deepgram REST TTS using env configuration."""

    def __init__(self, *, config: DeepgramConfig | None = None) -> None:
        self._config = config or DeepgramConfig.from_env()
        self._client: AsyncDeepgramClient | None = None

    def _get_client(self) -> AsyncDeepgramClient:
        self._config.validate()
        if self._client is None:
            self._client = AsyncDeepgramClient(api_key=self._config.api_key)
        return self._client

    async def synthesize(self, text: str) -> bytes:
        chunks: list[bytes] = []
        async for chunk in self.stream(text):
            chunks.append(chunk)
        return b"".join(chunks)

    async def stream(self, text: str) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        client = self._get_client()
        async for chunk in client.speak.v1.audio.generate(
            text=text,
            model=self._config.tts_model,
            encoding=self._config.tts_encoding,
        ):
            yield chunk
