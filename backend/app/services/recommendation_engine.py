import re

# Primary hiring tech signals → boost matching catalog names, penalize mismatches.
TECH_SIGNALS: dict[str, tuple[str, ...]] = {
    "python": ("python", "django", "flask"),
    "java": ("java", "j2ee", "spring"),
    "javascript": ("javascript", "js", "node", "react", "angular"),
    "c#": ("c#", "csharp", ".net", "asp.net", "dotnet"),
    "sql": ("sql", "database"),
    "react": ("react",),
    "angular": ("angular",),
}

TECH_CONFLICTS: dict[str, tuple[str, ...]] = {
    "python": ("asp.net", ".net", "c#", "csharp", "java ", "javascript", "angular", "react"),
    "java": ("python", "asp.net", "c#", "javascript"),
    "javascript": ("python", "java ", "asp.net", "c#"),
    "c#": ("python", "java ", "javascript"),
}

SENIORITY_BOOST_TERMS: dict[str, tuple[str, ...]] = {
    "junior": ("entry", "entry level", "fundamental", "basic", "new"),
    "senior": ("senior", "advanced", "lead", "manager", "executive"),
    "mid": ("mid", "intermediate"),
}


def _infer_test_type(keys: str) -> str:
    lowered = keys.lower()
    if "personality" in lowered or "behavior" in lowered:
        return "P"
    if "knowledge" in lowered or "skills" in lowered or "ability" in lowered:
        return "K"
    return keys[:1].upper() if keys else ""


def format_recommendations(docs):
    recommendations = []
    for doc in docs:
        keys = doc.metadata.get("keys", "") or ""
        recommendations.append(
            {
                "name": doc.metadata.get("name", ""),
                "url": doc.metadata.get("url", ""),
                "test_type": _infer_test_type(keys),
            }
        )
    return recommendations


def _detect_primary_tech(query: str) -> str | None:
    q = query.lower()
    for tech, signals in TECH_SIGNALS.items():
        if tech in q or any(s in q for s in signals):
            return tech
    return None


def _detect_seniority(query: str) -> str | None:
    q = query.lower()
    if any(t in q for t in ("junior", "entry level", "entry-level", "graduate")):
        return "junior"
    if any(t in q for t in ("senior", "lead", "principal", "director")):
        return "senior"
    if "mid" in q:
        return "mid"
    return None


def _doc_blob(doc) -> str:
    name = (doc.metadata.get("name") or "").lower()
    keys = (doc.metadata.get("keys") or "").lower()
    body = (getattr(doc, "page_content", None) or "").lower()
    return f"{name} {keys} {body}"


def score_document(query: str, doc) -> int:
    q = query.lower()
    blob = _doc_blob(doc)
    name = (doc.metadata.get("name") or "").lower()
    score = 0

    primary = _detect_primary_tech(q)
    if primary:
        for signal in TECH_SIGNALS[primary]:
            if signal in name:
                score += 25
            elif signal in blob:
                score += 12

        for conflict in TECH_CONFLICTS.get(primary, ()):
            if conflict in name:
                score -= 40
            elif conflict in blob:
                score -= 15

    seniority = _detect_seniority(q)
    if seniority:
        for term in SENIORITY_BOOST_TERMS.get(seniority, ()):
            if term in blob:
                score += 8

    if "personality" in q and "personality" in blob:
        score += 10
    if "leadership" in q and ("personality" in blob or "competenc" in blob):
        score += 10
    if "stakeholder" in q and ("communication" in blob or "personality" in blob):
        score += 6

    if "interview" in q and "interview" in name:
        score += 8

    # Penalize unrelated domains unless user asked for them
    if primary == "python" and not any(
        t in q for t in ("sales", "email", "customer", "support")
    ):
        if any(t in name for t in ("sales", "email writing", "asp.net", ".net")):
            score -= 30

    if primary == "java":
        if "java" in name:
            score += 25
        if any(t in name for t in ("job control language", "jcl", "cobol", "mainframe")):
            score -= 40
        if any(t in name for t in ("python", "asp.net", ".net", "c#")):
            score -= 25

    return score


def filter_docs_for_primary_tech(query: str, docs: list) -> list:
    """Keep only assessments matching the current role's primary tech."""
    primary = _detect_primary_tech(query.lower())
    if not primary or not docs:
        return docs

    matched: list = []
    for doc in docs:
        name = (doc.metadata.get("name") or "").lower()
        blob = _doc_blob(doc)

        if primary == "python" and any(
            x in name for x in ("java ", "jcl", "job control", "asp.net", "c#")
        ):
            continue
        if primary == "java" and any(
            x in name
            for x in ("python", "django", "flask", "asp.net", "c#", "javascript")
        ):
            continue
        if primary == "javascript" and any(
            x in name for x in ("python", "java ", "jcl", "c#", ".net")
        ):
            continue

        if primary in name or primary in blob:
            matched.append(doc)

    return matched if len(matched) >= 2 else docs


def prioritize_results(query: str, docs: list) -> list:
    if not docs:
        return []

    scored = [(score_document(query, doc), doc) for doc in docs]
    scored.sort(key=lambda x: x[0], reverse=True)

    primary = _detect_primary_tech(query)
    if primary:
        positive = [doc for s, doc in scored if s > 0]
        if positive:
            return positive[:10]

    return [doc for _, doc in scored[:10]]


def build_retrieval_query(messages_text: str) -> str:
    """Enrich user conversation text for better vector retrieval."""
    base = messages_text.strip()
    if not base:
        return base

    q = base.lower()
    parts = [base, "SHL assessment recommendation"]

    primary = _detect_primary_tech(q)
    if primary:
        parts.append(f"{primary} programming technical skills test")

    seniority = _detect_seniority(q)
    if seniority:
        parts.append(f"{seniority} level hiring")

    if "stakeholder" in q:
        parts.append("communication interpersonal workplace")

    return " ".join(parts)
