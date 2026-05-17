import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.voice.messages import error_message, parse_client_message, status_message
from app.voice.session import VoiceSession

logger = logging.getLogger(__name__)


async def handle_voice_websocket(websocket: WebSocket) -> None:
    """Voice loop — connection is already accepted in main.py."""
    session = VoiceSession(websocket)

    await websocket.send_text(
        status_message(connected=True, mode=session.mode.value, stt_ready=False)
    )

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"]:
                await session.handle_audio(message["bytes"])
                continue

            if "text" in message and message["text"]:
                payload = parse_client_message(message["text"])
                if payload:
                    await session.handle_control(payload)
                else:
                    await websocket.send_text(
                        error_message("Invalid JSON control message")
                    )

    except WebSocketDisconnect:
        logger.info("Voice WebSocket disconnected")
    except Exception as exc:
        logger.exception("Voice WebSocket error: %s", exc)
        try:
            await websocket.send_text(error_message(str(exc)))
        except Exception:
            pass
    finally:
        await session.close()
