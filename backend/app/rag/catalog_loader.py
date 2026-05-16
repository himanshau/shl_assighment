"""Load SHL product catalog from the public URL or a local JSON file."""

import json
import os
from pathlib import Path

import requests

DEFAULT_CATALOG_URL = (
    "https://tcp-us-prod-rnd.shl.com/voiceRater/shl-ai-hiring/shl_product_catalog.json"
)
LOCAL_CATALOG_PATH = Path("data/shl_product_catalog.json")


def _normalize_raw_json(raw: str) -> str:
    return raw.replace("\n", " ").replace("\r", " ").replace("\t", " ")


def fetch_catalog_from_url(url: str | None = None, timeout: int = 120) -> str:
    """Download catalog JSON from SHL (or custom URL)."""
    catalog_url = (url or os.getenv("CATALOG_URL") or DEFAULT_CATALOG_URL).strip()
    response = requests.get(catalog_url, timeout=timeout)
    response.raise_for_status()
    return response.text


def save_catalog_local(raw: str, path: Path | None = None) -> Path:
    target = path or LOCAL_CATALOG_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(raw, encoding="utf-8")
    return target


def load_catalog_items(
    *,
    prefer_remote: bool | None = None,
    cache_remote: bool = True,
) -> list[dict]:
    """
    Load assessment list for ingest / tooling.

    Order:
    1. If USE_REMOTE_CATALOG=true or local file missing → download from CATALOG_URL
    2. Otherwise read backend/data/shl_product_catalog.json
    """
    use_remote = prefer_remote
    if use_remote is None:
        use_remote = os.getenv("USE_REMOTE_CATALOG", "").lower() in (
            "1",
            "true",
            "yes",
        )

    if use_remote or not LOCAL_CATALOG_PATH.exists():
        raw = fetch_catalog_from_url()
        if cache_remote:
            save_catalog_local(raw)
            source = f"remote ({os.getenv('CATALOG_URL', DEFAULT_CATALOG_URL)})"
        else:
            source = "remote (not cached)"
    else:
        raw = LOCAL_CATALOG_PATH.read_text(encoding="utf-8")
        source = str(LOCAL_CATALOG_PATH)

    data = json.loads(_normalize_raw_json(raw), strict=False)
    if not isinstance(data, list):
        raise ValueError("Catalog JSON must be a list of assessments")

    print(f"Loaded {len(data)} assessments from {source}")
    return data


def catalog_items_to_documents(data: list[dict]) -> list:
    from langchain_core.documents import Document

    documents = []
    for idx, item in enumerate(data):
        text = f"""
    Assessment Name:
    {item.get('name', '')}

    Description:
    {item.get('description', '')}

    Job Levels:
    {', '.join(item.get('job_levels', []))}

    Languages:
    {', '.join(item.get('languages', []))}

    Remote Testing Support:
    {item.get('remote', '')}

    Adaptive Testing:
    {item.get('adaptive', '')}

    Assessment Categories:
    {', '.join(item.get('keys', []))}

    Duration:
    {item.get('duration', '')}
    """
        documents.append(
            Document(
                page_content=text,
                metadata={
                    "id": str(idx),
                    "entity_id": item.get("entity_id", ""),
                    "name": item.get("name", ""),
                    "url": item.get("link", ""),
                    "remote": item.get("remote", ""),
                    "adaptive": item.get("adaptive", ""),
                    "duration": item.get("duration", ""),
                    "job_levels": ", ".join(item.get("job_levels", [])),
                    "languages": ", ".join(item.get("languages", [])),
                    "keys": ", ".join(item.get("keys", [])),
                },
            )
        )
    return documents
