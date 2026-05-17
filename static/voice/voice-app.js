/** Same WebSocket voice flow as frontend/hooks/useVoiceAgent.ts */

function getWsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

async function startPcmRecorder(onChunk) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);
  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    const pcm = floatTo16BitPCM(channel);
    const copy = new ArrayBuffer(pcm.byteLength);
    new Int16Array(copy).set(pcm);
    onChunk(copy);
  };
  return {
    stop() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void audioContext.close();
    },
  };
}

let currentAudio = null;
let ttsPlaying = Promise.resolve();

function playReadyTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
    osc.onended = () => void ctx.close();
  } catch (_) {}
}

function stopTts() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  ttsPlaying = Promise.resolve();
}

function enqueueMp3Buffer(buffer) {
  stopTts();
  ttsPlaying = new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(new Error("TTS playback failed"));
    };
    void audio.play().catch(reject);
  });
}

function whenTtsQueueIdle() {
  return ttsPlaying;
}

function roleTitleFromMessage(message) {
  const cleaned = message
    .replace(/^[\s,.:;]+/, "")
    .replace(/\b(and one more thing|also|i need|i want|an assistant in|assistant in)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Hiring request";
  const lower = cleaned.toLowerCase();
  const seniority =
    ["senior", "junior", "mid-level", "mid level", "entry-level", "entry level"].find((s) =>
      lower.includes(s),
    ) || "";
  const tech =
    ["python", "java", "javascript", "react", "angular", ".net", "c#"].find((s) =>
      lower.includes(s),
    ) || "";
  const roleWord = lower.includes("developer")
    ? "Developer"
    : lower.includes("manager")
      ? "Manager"
      : lower.includes("engineer")
        ? "Engineer"
        : lower.includes("analyst")
          ? "Analyst"
          : "Role";
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  if (seniority && tech) return `${cap(seniority)} ${cap(tech)} ${roleWord}`;
  if (tech) return `${cap(tech)} ${roleWord}`;
  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69)}…`;
}

class VoiceClient {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.ws = null;
    this.connectPromise = null;
  }

  get connected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise((resolve, reject) => {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timed out"));
      }, 15000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.callbacks.onOpen?.();
        resolve();
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        this.ws = null;
        this.connectPromise = null;
        this.callbacks.onClose?.();
      };
      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.callbacks.onTtsAudio?.(event.data);
          return;
        }
        try {
          this.callbacks.onMessage?.(JSON.parse(event.data));
        } catch {
          this.callbacks.onError?.("Invalid server message");
        }
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        this.connectPromise = null;
        const err = `WebSocket failed (${url}). Check DEEPGRAM_API_KEY in Space secrets.`;
        this.callbacks.onError?.(err);
        reject(new Error(err));
      };
    });
    return this.connectPromise;
  }

  disconnect() {
    this.sendControl({ type: "stop_listening" });
    this.ws?.close();
    this.ws = null;
    this.connectPromise = null;
  }

  sendControl(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  sendAudio(chunk) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(chunk);
  }

  startListening() {
    this.sendControl({ type: "start_listening" });
  }

  reset() {
    this.sendControl({ type: "reset" });
  }
}

function displayTranscript(committed, interim) {
  const c = (committed || "").trim();
  const i = (interim || "").trim();
  if (c && i) return `${c} ${i}`;
  return c || i;
}

function initVoiceApp() {
  const el = {
    micBtn: document.getElementById("mic-btn"),
    led: document.getElementById("led"),
    ledLabel: document.getElementById("led-label"),
    micStatus: document.getElementById("mic-status"),
    heroDesc: document.getElementById("hero-desc"),
    liveBox: document.getElementById("live-transcript"),
    chat: document.getElementById("chat"),
    recScroll: document.getElementById("rec-scroll"),
    recSection: document.getElementById("rec-section"),
    error: document.getElementById("error"),
    textInput: document.getElementById("text-input"),
    sendText: document.getElementById("send-text"),
    resetBtn: document.getElementById("reset-btn"),
  };

  let client = null;
  let recorder = null;
  let connected = false;
  let micState = "idle";
  let committed = "";
  let interim = "";
  let turns = [];
  let bundles = [];
  let ttsActive = false;
  let processing = false;
  let pendingResume = false;
  let sttReadyResolve = null;
  let sttReject = null;

  function setError(msg) {
    if (msg) {
      el.error.textContent = msg;
      el.error.classList.add("visible");
    } else {
      el.error.classList.remove("visible");
    }
  }

  function pauseMic() {
    recorder?.stop();
    recorder = null;
  }

  async function resumeMic() {
    if (!client?.connected) return;
    if (!recorder) {
      recorder = await startPcmRecorder((chunk) => client.sendAudio(chunk));
    }
  }

  function tryResumeAfterTts() {
    if (!pendingResume || ttsActive) return;
    void whenTtsQueueIdle().then(() => {
      if (!pendingResume || ttsActive) return;
      setTimeout(() => {
        if (!pendingResume || ttsActive) return;
        pendingResume = false;
        void resumeMic();
      }, 400);
    });
  }

  function renderStatus() {
    const busy = micState === "connecting";
    el.micBtn.disabled = busy;
    el.micBtn.classList.toggle("connected", connected);
    el.led.className = "led" + (busy ? " busy" : connected ? " on" : "");
    el.ledLabel.textContent = busy ? "Connecting…" : connected ? "Connected" : "Offline";
    let line = "Tap to connect";
    if (busy) line = "Connecting…";
    else if (connected) {
      if (processing) line = "Thinking…";
      else if (ttsActive) line = "Speaking…";
      else line = "Listening — speak anytime";
    }
    el.micStatus.textContent = line;
    el.heroDesc.textContent = connected
      ? "Multi-turn voice assistant — I clarify first, then recommend SHL assessments from the catalog."
      : "One tap connects you. Speak naturally; I respond when you pause.";
  }

  function renderChat() {
    el.chat.innerHTML = "";
    for (const turn of turns) {
      el.chat.appendChild(makeBubble(turn.role, turn.content));
    }
    const live = displayTranscript(committed, interim);
    if (connected && live && !processing) {
      el.chat.appendChild(makeBubble("user", live, true));
    }
    if (processing) {
      el.chat.appendChild(makeBubble("ai", "Thinking…", false, true));
    }
    const showLive = connected && (live || processing || ttsActive);
    el.liveBox.textContent = live || "";
    el.liveBox.classList.toggle("visible", showLive && !!live);
  }

  function makeBubble(role, content, isInterim = false, isThinking = false) {
    const rowEl = document.createElement("div");
    rowEl.className = `bubble-row ${role === "user" ? "user" : "ai"}`;
    const avatarBox = document.createElement("div");
    avatarBox.className = `avatar ${role === "user" ? "user" : "ai"}`;
    avatarBox.textContent = role === "user" ? "U" : "AI";
    const bubble = document.createElement("div");
    bubble.className =
      "bubble" + (isInterim ? " interim" : "") + (isThinking ? " thinking" : "");
    bubble.textContent = content;
    rowEl.appendChild(avatarBox);
    rowEl.appendChild(bubble);
    return rowEl;
  }

  function renderRecs() {
    el.recScroll.innerHTML = "";
    el.recSection.style.display = bundles.length ? "block" : "none";
    bundles.forEach((bundle, index) => {
      const card = document.createElement("article");
      card.className = "rec-card";
      const items = bundle.recommendations
        .map(
          (r) =>
            `<li><a href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a><div class="type">Type: ${escapeHtml(r.test_type || "—")}</div></li>`,
        )
        .join("");
      card.innerHTML = `
        <header>
          <div class="meta">Role ${index + 1}</div>
          <h4>${escapeHtml(bundle.roleTitle)}</h4>
          ${bundle.userMessage ? `<p style="margin:8px 0 0;font-size:12px;color:#64748b;font-style:italic">"${escapeHtml(bundle.userMessage)}"</p>` : ""}
        </header>
        <ul>${items}</ul>`;
      el.recScroll.appendChild(card);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case "status":
        if (msg.tts_interrupted) {
          stopTts();
          ttsActive = false;
        }
        if (msg.tts_playing !== undefined) ttsActive = msg.tts_playing;
        if (msg.processing !== undefined) processing = msg.processing;
        if (msg.stt_ready) sttReadyResolve?.();
        if (msg.ready_for_next) {
          pendingResume = true;
          committed = "";
          interim = "";
          tryResumeAfterTts();
        }
        renderChat();
        renderStatus();
        break;
      case "transcript":
        if (ttsActive && msg.interim && msg.interim.split(" ").length >= 2) stopTts();
        if (msg.committed !== undefined) committed = msg.committed;
        if (msg.interim !== undefined) interim = msg.interim;
        if (msg.committed === undefined && msg.interim === undefined && msg.text) {
          if (msg.is_final) {
            committed = `${committed} ${msg.text}`.trim();
            interim = "";
          } else {
            interim = msg.text;
          }
        }
        renderChat();
        break;
      case "chat_response": {
        const userText = msg.user_message || committed.trim();
        committed = "";
        interim = "";
        if (!(msg.greeting && turns.some((t) => t.role === "assistant" && t.content === msg.reply))) {
          if (userText) turns.push({ role: "user", content: userText });
          const last = turns[turns.length - 1];
          if (!(last?.role === "assistant" && last.content === msg.reply && !userText)) {
            turns.push({ role: "assistant", content: msg.reply });
          }
        }
        if (msg.recommendations?.length && userText) {
          bundles.push({
            id: `${Date.now()}-${bundles.length}`,
            roleTitle: roleTitleFromMessage(userText),
            userMessage: userText.trim(),
            recommendations: msg.recommendations,
          });
        }
        processing = false;
        renderChat();
        renderRecs();
        renderStatus();
        break;
      }
      case "error":
        setError(msg.message);
        processing = false;
        sttReject?.(new Error(msg.message));
        sttReadyResolve = null;
        sttReject = null;
        renderStatus();
        break;
    }
  }

  function waitForStt() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sttReadyResolve = null;
        sttReject = null;
        reject(new Error("Speech recognition timed out. Check DEEPGRAM_API_KEY."));
      }, 20000);
      sttReadyResolve = () => {
        clearTimeout(timer);
        sttReadyResolve = null;
        sttReject = null;
        resolve();
      };
      sttReject = (err) => {
        clearTimeout(timer);
        sttReadyResolve = null;
        sttReject = null;
        reject(err);
      };
    });
  }

  function ensureClient() {
    if (!client) {
      client = new VoiceClient({
        onOpen: () => {
          connected = true;
          renderStatus();
        },
        onClose: () => {
          connected = false;
          micState = "idle";
          pauseMic();
          renderStatus();
          renderChat();
        },
        onMessage: handleMessage,
        onTtsAudio: (buf) => {
          enqueueMp3Buffer(buf);
          void whenTtsQueueIdle().then(() => tryResumeAfterTts());
        },
        onError: setError,
      });
    }
    return client;
  }

  async function connect() {
    setError(null);
    committed = "";
    interim = "";
    micState = "connecting";
    renderStatus();
    renderChat();
    try {
      const c = ensureClient();
      if (!c.connected) await c.connect();
      c.startListening();
      await waitForStt();
      playReadyTone();
      await resumeMic();
      micState = "connected";
      pendingResume = false;
      renderStatus();
      renderChat();
    } catch (e) {
      micState = "idle";
      setError(e.message || "Could not connect");
      renderStatus();
    }
  }

  function disconnect() {
    stopTts();
    pendingResume = false;
    pauseMic();
    client?.disconnect();
    client = null;
    connected = false;
    micState = "idle";
    processing = false;
    committed = "";
    interim = "";
    renderStatus();
    renderChat();
  }

  async function toggleMic() {
    if (micState === "connecting") return;
    if (connected || micState === "connected") {
      disconnect();
      return;
    }
    await connect();
  }

  async function sendTextChat() {
    const content = el.textInput.value.trim();
    if (!content) return;
    setError(null);
    processing = true;
    el.textInput.value = "";
    turns.push({ role: "user", content });
    renderChat();
    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: turns.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data = await res.json();
      turns.push({ role: "assistant", content: data.reply });
      if (data.recommendations?.length) {
        bundles.push({
          id: `${Date.now()}-text`,
          roleTitle: roleTitleFromMessage(content),
          userMessage: content,
          recommendations: data.recommendations,
        });
        renderRecs();
      }
    } catch (e) {
      setError(e.message || "Chat failed");
    } finally {
      processing = false;
      renderChat();
    }
  }

  function resetAll() {
    client?.reset();
    disconnect();
    turns = [];
    bundles = [];
    renderChat();
    renderRecs();
    setError(null);
  }

  el.micBtn.addEventListener("click", () => void toggleMic());
  el.sendText.addEventListener("click", () => void sendTextChat());
  el.textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void sendTextChat();
  });
  el.resetBtn.addEventListener("click", resetAll);

  renderStatus();
  renderChat();
  renderRecs();
}

document.addEventListener("DOMContentLoaded", initVoiceApp);
