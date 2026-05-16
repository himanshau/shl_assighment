"""Run: python scripts/test_deepgram.py (from backend/)"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()


async def main() -> None:
    import httpx
    from app.voice.deepgram_config import DeepgramConfig
    from app.voice.deepgram_stt import DeepgramRealtimeSTT

    config = DeepgramConfig.from_env()
    config.validate()

    print("=== Deepgram API key (REST) ===")
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.deepgram.com/v1/projects",
            headers={"Authorization": f"Token {config.api_key}"},
            timeout=15.0,
        )
    print(f"  Status: {r.status_code} ({ 'OK' if r.status_code == 200 else 'FAIL' })")

    print("\n=== Deepgram live STT (WebSocket) ===")
    heard: list[str] = []

    async def on_transcript(text: str, is_final: bool) -> None:
        heard.append(text)
        print(f"  transcript (final={is_final}): {text!r}")

    stt = DeepgramRealtimeSTT(on_transcript=on_transcript, config=config)
    await stt.start()
    print("  WebSocket: OK (connected)")

  # Send ~0.5s of silence (zeros) so Deepgram accepts the stream
    silence = b"\x00\x00" * (config.sample_rate // 2)
    await stt.send_audio(silence)
    await asyncio.sleep(1)
    await stt.close()
    print("  Closed cleanly")
    print("\nAll checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
