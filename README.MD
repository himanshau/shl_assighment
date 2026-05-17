---
title: SHL Assessment Recommender
emoji: 🎯
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# SHL Assessment Recommender

Conversational voice assistant (mic + Deepgram + Groq) + FastAPI `/health`, `/chat`, WebSocket `/ws`.

**Tap the mic** on the Space home page — same flow as the original Next.js demo.

## Space secrets (Settings → Variables)

| Variable | Required |
|----------|----------|
| `GROQ_API_KEY` | Yes |
| `DEEPGRAM_API_KEY` | Yes (voice mic + TTS) |

## Local run

```bash
pip install -r requirements.txt
export GROQ_API_KEY=your_key
uvicorn hf_app:app --host 0.0.0.0 --port 7860
```

Open http://localhost:7860
