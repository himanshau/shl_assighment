# SHL Assessment Recommender

Voice + chat assistant for SHL assessment recommendations (`POST /chat`, WebSocket voice).

## Repo layout

| Folder | Fly.io app (example) |
|--------|----------------------|
| `backend/` | `shl-assignment-api` — API, WebSocket, Chroma |
| `frontend/` | `shl-assignment-web` — Next.js UI |

**One GitHub monorepo, two Fly apps.** Full steps: **[DEPLOY_FLY.md](./DEPLOY_FLY.md)**

Secrets go on Fly with `fly secrets set` / `fly secrets import` — **never** commit `backend/.env`.

---

## Where is the JSON / catalog data?

**Public catalog (official):**  
https://tcp-us-prod-rnd.shl.com/voiceRater/shl-ai-hiring/shl_product_catalog.json

| What | Where | Purpose |
|------|--------|---------|
| **Live JSON** | URL above (or `CATALOG_URL` in `.env`) | Always up to date; no manual copy |
| **Local copy** | `backend/data/shl_product_catalog.json` | Cached after download; optional offline dev |
| **Vector index** | `backend/chroma_db/` | What `/chat` and voice search at runtime |
| **Ingest** | `backend/app/rag/ingest.py` | Builds `chroma_db` from JSON |

**At runtime the API reads `chroma_db`, not the URL.** Refresh when the catalog changes:

```powershell
cd backend
.\venv\Scripts\activate
# Download latest JSON from SHL and rebuild vectors
$env:USE_REMOTE_CATALOG="true"
python app/rag/ingest.py
fly deploy
```

Or without env var (uses local file if it exists):

```powershell
python app/rag/ingest.py
```

**Deploy options:**

1. **Simple (recommended):** commit `chroma_db/` in Git → Fly image includes it → fast startup.
2. **Always fresh:** on each deploy run ingest with `USE_REMOTE_CATALOG=true` in CI (slower build, ~5–10 min).
3. **Hybrid:** ship `chroma_db` in image; occasionally refresh from URL with ingest + redeploy.

No separate database host is required for the assignment.

---

## One repo or two?

| Approach | GitHub | Deploy |
|----------|--------|--------|
| **One repo (recommended)** | `backend/` + `frontend/` folders | Backend → Fly, Frontend → Vercel |
| **Two repos** | Optional split | Same hosts, more work to sync |
| **Both on Fly** | Still one repo is fine | Two Fly **apps** (two `fly deploy`, two `fly.toml`) |

You do **not** need two repos. One monorepo is normal and easier for assignments.

### Both backend + frontend on Fly (same repo)

Possible with **two Fly apps**:

1. `cd backend` → `fly deploy` (API + WebSocket + Chroma)
2. `cd frontend` → separate `fly.toml` + Next.js Dockerfile → `fly deploy`

Fly frontend is harder (Docker, env vars, cold starts). **Vercel for frontend + Fly for backend** is the easiest split.

---

## Quick deploy (Fly.io)

See **[DEPLOY_FLY.md](./DEPLOY_FLY.md)** for the full checklist.

```powershell
fly auth login
cd backend
fly secrets import < .env
fly launch && fly deploy
cd ../frontend
fly deploy --build-arg NEXT_PUBLIC_API_URL=https://shl-assignment-api.fly.dev --build-arg NEXT_PUBLIC_WS_URL=wss://shl-assignment-api.fly.dev/ws
```

Alternative: frontend on **Vercel** (root directory `frontend`) if you prefer easier Next.js hosting.

---

## Local run

```powershell
# Backend
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm run dev
```

Open http://localhost:3000
