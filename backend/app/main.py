import logging
import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.models.schemas import ChatRequest, ChatResponse
from app.services.chat_orchestrator import process_chat
from app.voice import handle_voice_websocket

logger = logging.getLogger(__name__)

app = FastAPI(title="SHL Assessment Recommender")

_DEFAULT_ORIGINS = (
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:3001,http://127.0.0.1:3001"
)
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    return process_chat(request)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket voice channel — accept immediately, then delegate to voice handler."""
    await websocket.accept()
    logger.info("WebSocket accepted from %s", websocket.client)
    await handle_voice_websocket(websocket)
