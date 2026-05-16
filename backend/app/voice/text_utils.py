import re


def plain_speech_text(text: str) -> str:
    """Strip markdown and list formatting so TTS sounds natural."""
    if not text:
        return ""

    t = text
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"^\s*#{1,6}\s*", "", t, flags=re.MULTILINE)
    t = re.sub(r"^\s*[-*]\s+", "", t, flags=re.MULTILINE)
    t = re.sub(r"^\s*\d+\.\s*", "", t, flags=re.MULTILINE)
    t = re.sub(r"\s+", " ", t)
    return t.strip()
