import re

OFF_TOPIC_PATTERNS = [
    "legal advice",
    "salary negotiation",
    "write my resume",
    "ignore previous",
    "ignore all instructions",
    "system prompt",
    "jailbreak",
    "pretend you are",
]

ROLE_SKILL_SIGNALS = (
    "java",
    "python",
    "javascript",
    "developer",
    "engineer",
    "stakeholder",
    "personality",
    "leadership",
    "aptitude",
    "technical",
    "skills",
    "analyst",
    "manager",
    "consultant",
    "project manager",
    "hiring",
    "hire",
    "role",
)

SENIORITY_SIGNALS = (
    "senior",
    "junior",
    "mid-level",
    "mid level",
    "entry",
    "principal",
    "lead",
    "management",
    "manager",
    "years",
    "year experience",
    "yoe",
    "director",
    "executive",
)

# Incomplete / filler speech — do not run RAG or invent answers.
FILLER_PATTERNS = (
    r"^(hi|hello|hey|yo)[\s?!.,]*$",
    r"^(um+|uh+|hmm+)[\s?!.,]*$",
    r"^i mean[\s?!.,]*$",
    r"^hello\??\s*i mean[\s?!.,]*$",
    r"^can you hear me[\s?!.,]*$",
    r"^are you there[\s?!.,]*$",
    r"^i need to assist[\s?!.,]*$",
    r"^i need help[\s?!.,]*$",
)


def is_actionable_utterance(text: str) -> bool:
    """True when the user said enough to run /chat (avoids noise and TTS echo)."""
    cleaned = re.sub(r"\s+", " ", text.lower().strip())
    if not cleaned:
        return False

    for pattern in FILLER_PATTERNS:
        if re.match(pattern, cleaned):
            return False

    words = cleaned.split()
    if len(words) < 4:
        has_signal = any(s in cleaned for s in ROLE_SKILL_SIGNALS) or any(
            s in cleaned for s in SENIORITY_SIGNALS
        )
        return has_signal

    return True


def needs_clarification(
    query: str,
    *,
    user_turns: int = 1,
    conversation_context: str = "",
) -> bool:
    query = query.lower().strip()
    words = query.split()

    if not is_actionable_utterance(query):
        return True

    ctx = f"{query} {conversation_context}".lower()
    has_role_skill = any(signal in query for signal in ROLE_SKILL_SIGNALS)
    has_seniority = any(signal in ctx for signal in SENIORITY_SIGNALS)

    if has_role_skill and has_seniority:
        return False

    if has_role_skill and not has_seniority:
        return True

    if user_turns <= 1 and len(words) <= 5:
        vague_hints = ("assessment", "assessments", "test", "tests", "help", "recommend")
        if any(h in query for h in vague_hints) and not has_role_skill:
            return True

    if len(words) <= 3:
        return True

    vague_only = {
        "assessment",
        "assessments",
        "test",
        "tests",
        "developer",
        "engineer",
        "job",
        "hiring",
    }
    if query in vague_only:
        return True

    return False


def is_comparison_query(query: str) -> bool:
    comparison_words = ["difference", "compare", " vs ", "versus", "between"]
    q = query.lower()
    return any(word in q for word in comparison_words)


def is_off_topic(text: str) -> bool:
    lowered = text.lower()
    return any(pattern in lowered for pattern in OFF_TOPIC_PATTERNS)


def clarification_response() -> str:
    return (
        "I didn't catch a full hiring brief yet. "
        "What role are you hiring for, the seniority level, and which skills to assess?"
    )


def refusal_response() -> str:
    return (
        "I can only help with SHL assessment recommendations from our catalog. "
        "Tell me about the role you are hiring for and what you want to measure."
    )
