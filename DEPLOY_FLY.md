# Deploy on Fly.io (monorepo — two apps)

One GitHub repo, **two Fly applications**:

| Fly app name | Folder | URL example |
|--------------|--------|-------------|
| `shl-assignment-api` | `backend/` | `https://shl-assignment-api.fly.dev` |
| `shl-assignment-web` | `frontend/` | `https://shl-assignment-web.fly.dev` |

Fly does **not** deploy the whole monorepo in one click. You create **two apps** from the **same repo**.

---

## Prerequisites

1. [Fly.io account](https://fly.io/app/sign-up) + [install `flyctl`](https://fly.io/docs/hands-on/install-flyctl/)
2. `fly auth login`
3. Local `backend/.env` with real keys (never commit this file)
4. `chroma_db/` built and committed (or ingest before deploy)

---

## Step 1 — Push to GitHub

```powershell
cd c:\Users\hs901\Desktop\shl_assighmetn
git init
git add .
git status
git commit -m "SHL assessment recommender: voice + chat + Fly deploy"
git branch -M main
git remote add origin https://github.com/himanshau/shl_assighment.git
git push -u origin main
```

`.gitignore` blocks `.env`, `node_modules`, `.next`, and `venv`.

---

## Step 2 — Fly secrets (credentials without Git)

**.env is not in Git.** On Fly you use **secrets** (encrypted env vars).

### Option A — Import from local `.env` (easiest)

```powershell
cd backend
# Only keys Fly needs (edit fly-secrets.env locally, never commit)
fly secrets import < .env
```

### Option B — Set one by one

```powershell
cd backend
fly secrets set GROQ_API_KEY="your_groq_key"
fly secrets set DEEPGRAM_API_KEY="your_deepgram_key"
fly secrets set CORS_ORIGINS="http://localhost:3000"
```

List secrets: `fly secrets list`  
Unset: `fly secrets unset KEY_NAME`

Use `backend/fly-secrets.example` as a checklist.

---

## Step 3 — Deploy backend (API + WebSocket + Chroma)

```powershell
cd backend
fly launch
```

- App name: `shl-assignment-api` (or accept Fly’s suggestion and update `fly.toml`)
- Region: `iad` (or closest to you)
- **Do not** add Postgres/Redis
- Deploy now: **Yes** (after secrets are set)

If app already exists:

```powershell
fly deploy
```

Test:

```powershell
fly open /health
# Expect: {"status":"ok"}
```

Note your API host, e.g. `https://shl-assignment-api.fly.dev`.

---

## Step 4 — Update CORS for frontend URL

After you know the frontend Fly URL (or plan it):

```powershell
cd backend
fly secrets set CORS_ORIGINS="https://shl-assignment-web.fly.dev,http://localhost:3000"
```

Redeploy if already running:

```powershell
fly deploy
```

---

## Step 5 — Deploy frontend (Next.js)

Replace `YOUR-API` with your real backend host from step 3.

```powershell
cd frontend
fly launch
```

- App name: `shl-assignment-web`
- Deploy: **Yes**, with build args:

```powershell
fly deploy ^
  --build-arg NEXT_PUBLIC_API_URL=https://shl-assignment-api.fly.dev ^
  --build-arg NEXT_PUBLIC_WS_URL=wss://shl-assignment-api.fly.dev/ws
```

(PowerShell line continuation; use `\` on bash.)

Open site: `fly open`

---

## Step 6 — Connect GitHub to Fly (optional CI)

For each app in [Fly dashboard](https://fly.io/dashboard):

1. **Create app** → **Deploy from GitHub**
2. Select `himanshau/shl_assighment`
3. **Important:** set **Root Directory** / working directory:
   - Backend app → `backend`
   - Frontend app → `frontend`
4. Backend: add secrets in dashboard (same as `fly secrets set`)
5. Frontend: add **build arguments** for `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`

---

## What to set on Fly (checklist)

### Backend secrets (`cd backend`)

| Secret | Required |
|--------|----------|
| `GROQ_API_KEY` | Yes |
| `DEEPGRAM_API_KEY` | Yes |
| `CORS_ORIGINS` | Yes (include frontend Fly URL) |
| `DEEPGRAM_*` | Optional (defaults in code) |
| `CATALOG_URL` | Optional |

### Frontend build args (deploy time)

| Build arg | Example |
|-----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://shl-assignment-api.fly.dev` |
| `NEXT_PUBLIC_WS_URL` | `wss://shl-assignment-api.fly.dev/ws` |

### Fly machine sizes (in `fly.toml`)

- Backend: **2048 MB** RAM (embeddings + Chroma)
- Frontend: **512 MB** RAM

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error in browser | Add frontend URL to backend `CORS_ORIGINS`, redeploy backend |
| WebSocket fails | Use `wss://` (not `ws://`) on HTTPS frontend |
| Slow first request | Fly `auto_stop_machines` — cold start; wait ~30s |
| Build fails on frontend | Pass both `NEXT_PUBLIC_*` build args |
| 502 on backend | `fly logs` — often missing secrets or Chroma not in image |

```powershell
fly logs -a shl-assignment-api
fly logs -a shl-assignment-web
```

---

## Catalog data on Fly

Ship `backend/chroma_db/` in Git (recommended). Refresh from public URL:

```powershell
cd backend
$env:USE_REMOTE_CATALOG="true"
python app/rag/ingest.py
fly deploy
```

Public JSON: https://tcp-us-prod-rnd.shl.com/voiceRater/shl-ai-hiring/shl_product_catalog.json
