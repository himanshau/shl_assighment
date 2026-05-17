# Deploy on Hugging Face Spaces

Repo root **is** the Space (Docker). No `backend/` or `frontend/` subfolders.

## 1. Create Space (one time)

https://huggingface.co/new-space → **Docker**, name e.g. `shl-assessment-recommender`

Or CLI (after `hf auth login`):

```powershell
hf repo create shl-assessment-recommender --repo-type space --space-sdk docker
```

## 2. Push code

**GitHub (recommended):** connect Space to `himanshau/shl_assighment`, branch `main`, root `/`.

**CLI upload from repo root:**

```powershell
cd c:\Users\hs901\Desktop\shl_assighmetn
hf upload himanshau/shl-assessment-recommender . . --repo-type space
```

## 3. Secrets (Settings → Secrets)

| Secret | Required |
|--------|----------|
| `GROQ_API_KEY` | Yes |
| `DEEPGRAM_API_KEY` | Yes (voice mic) |

CLI:

```powershell
hf spaces secrets add himanshau/shl-assessment-recommender GROQ_API_KEY
hf spaces secrets add himanshau/shl-assessment-recommender DEEPGRAM_API_KEY
```

## 4. Live URL

`https://himanshau-shl-assessment-recommender.hf.space`

(Voice UI at `/`, API: `/health`, `/chat`, WebSocket `/ws`)

## Local run

```powershell
pip install -r requirements.txt
$env:GROQ_API_KEY="..."
$env:DEEPGRAM_API_KEY="..."
uvicorn hf_app:app --host 127.0.0.1 --port 7860
```
