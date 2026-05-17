import re

WAKE_PHRASES = ("hey alexa", "ok alexa", "alexa")


def detect_wake_word(text: str) -> bool:
    normalized = " ".join(text.lower().split())
    return any(phrase in normalized for phrase in WAKE_PHRASES)


def strip_wake_word(text: str) -> str:
    """Remove wake-word phrases so only the hiring intent is sent to /chat."""
    cleaned = text
    for phrase in sorted(WAKE_PHRASES, key=len, reverse=True):
        cleaned = re.sub(rf"\b{re.escape(phrase)}\b", "", cleaned, flags=re.IGNORECASE)
    return " ".join(cleaned.split())
