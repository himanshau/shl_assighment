import re


def split_for_tts(text: str, max_len: int = 180) -> list[str]:
    """Split reply into short clauses for chunked TTS streaming."""
    text = text.strip()
    if not text:
        return []

    parts = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    buf = ""

    for part in parts:
        if not part:
            continue
        candidate = f"{buf} {part}".strip() if buf else part
        if len(candidate) <= max_len:
            buf = candidate
        else:
            if buf:
                chunks.append(buf)
            buf = part

    if buf:
        chunks.append(buf)

    return chunks or [text]
