from app.services.chat_service import SENIORITY_SIGNALS
from app.services.recommendation_engine import build_retrieval_query as enrich_retrieval_query


def _latest_user_message(messages) -> str:
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content
    return ""


def build_retrieval_query(messages) -> str:
    """Vector search on the latest turn; inherit seniority from earlier user turns."""
    latest = _latest_user_message(messages)
    prior_user = " ".join(
        m.content
        for m in messages
        if m.role == "user" and m.content != latest
    )
    query = enrich_retrieval_query(latest)
    prior_lower = prior_user.lower()
    latest_lower = latest.lower()
    for signal in SENIORITY_SIGNALS:
        if signal in prior_lower and signal not in latest_lower:
            query = f"{query} {signal}"
    return query


def build_search_query(messages) -> str:
    """Full conversation context for clarification / comparison detection."""
    combined = []
    for msg in messages:
        if msg.role == "user":
            combined.append(msg.content)
    text = " ".join(combined)
    return enrich_retrieval_query(text)
