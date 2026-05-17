import json
from typing import Any


def ws_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload)


def parse_client_message(raw: str) -> dict[str, Any] | None:
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "type" in data:
            return data
    except json.JSONDecodeError:
        return None
    return None


def transcript_message(
    *,
    committed: str = "",
    interim: str = "",
    text: str | None = None,
    is_final: bool | None = None,
) -> str:
    """Stream stable committed + interim transcript lines to the client."""
    payload: dict[str, Any] = {
        "type": "transcript",
        "committed": committed,
        "interim": interim,
    }
    if text is not None:
        payload["text"] = text
    if is_final is not None:
        payload["is_final"] = is_final
    return ws_json(payload)


def status_message(**fields: Any) -> str:
    payload: dict[str, Any] = {"type": "status"}
    payload.update(fields)
    return ws_json(payload)


def chat_response_message(
    reply: str,
    recommendations: list[dict],
    end_of_conversation: bool,
    user_message: str | None = None,
    *,
    greeting: bool = False,
) -> str:
    payload: dict[str, Any] = {
        "type": "chat_response",
        "reply": reply,
        "recommendations": recommendations,
        "end_of_conversation": end_of_conversation,
    }
    if user_message:
        payload["user_message"] = user_message
    if greeting:
        payload["greeting"] = True
    return ws_json(payload)


def error_message(message: str) -> str:
    return ws_json({"type": "error", "message": message})


def wake_word_message(detected: bool) -> str:
    return ws_json({"type": "wake_word", "detected": detected})
