"""Gradio shell — embeds the same conversational voice UI as the Next.js app."""

from __future__ import annotations

import gradio as gr

VOICE_IFRAME = """
<iframe
  src="/"
  title="SHL Voice Assistant"
  allow="microphone"
  style="width:100%;min-height:960px;border:0;border-radius:12px;background:#0E171B;"
></iframe>
"""

CSS = """
.gradio-container { max-width: 1100px !important; margin: auto; }
footer { display: none !important; }
"""


def build_demo() -> gr.Blocks:
    with gr.Blocks(
        title="SHL Assessment Recommender",
        css=CSS,
        theme=gr.themes.Soft(primary_hue="blue", secondary_hue="slate"),
    ) as demo:
        gr.Markdown(
            """
            # SHL Assessment Recommender
            **Tap the mic** to connect — multi-turn voice chat (Deepgram STT/TTS + Groq + SHL catalog RAG).
            Same backend `/ws` WebSocket as the Next.js frontend.
            """
        )
        gr.HTML(VOICE_IFRAME)
        gr.Markdown(
            """
            ---
            **Secrets:** set `GROQ_API_KEY` and `DEEPGRAM_API_KEY` in Space settings.  
            **API:** `GET /health` · `POST /chat` · WebSocket `wss://…/ws`
            """
        )
    return demo
