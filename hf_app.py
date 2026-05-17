"""
Hugging Face Space entry point.

- Gradio UI at /
- FastAPI routes: GET /health, POST /chat, WebSocket /ws (voice, optional)

Run locally:
  uvicorn hf_app:app --host 0.0.0.0 --port 7860

HF Docker Space CMD:
  uvicorn hf_app:app --host 0.0.0.0 --port 7860
"""

from app.gradio_ui import build_demo
from app.main import app as fastapi_app
import gradio as gr

demo = build_demo()

# Voice UI at / ; Gradio docs at /gradio ; API at /health, /chat, /ws
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")
