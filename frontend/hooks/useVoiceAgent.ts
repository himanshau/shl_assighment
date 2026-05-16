"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postChat } from "@/lib/api/chat";
import { playReadyTone } from "@/lib/audio/ready-tone";
import { startPcmRecorder, type PcmRecorder } from "@/lib/audio/pcm-recorder";
import { appendRecommendationBundle } from "@/lib/recommendation-bundles";
import type {
  ChatMessage,
  ConversationTurn,
  MicState,
  RecommendationBundle,
  ServerMessage,
} from "@/lib/types";
import { VoiceClient } from "@/lib/voice/voice-client";
import { enqueueMp3Buffer, stopTts, whenTtsQueueIdle } from "@/lib/voice/tts-player";

function displayTranscript(committed: string, interim: string): string {
  const c = committed.trim();
  const i = interim.trim();
  if (c && i) return `${c} ${i}`;
  return c || i;
}

export function useVoiceAgent() {
  const clientRef = useRef<VoiceClient | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const sttReadyResolveRef = useRef<(() => void) | null>(null);
  const sttRejectRef = useRef<((err: Error) => void) | null>(null);
  const committedRef = useRef("");
  const interimRef = useRef("");
  const pendingResumeRef = useRef(false);
  const ttsPlayingRef = useRef(false);
  const handleServerMessageRef = useRef<(msg: ServerMessage) => void>(null);
  const tryResumeAfterTtsRef = useRef<() => void>(null);

  const [connected, setConnected] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [sttReady, setSttReady] = useState(false);
  const [committedTranscript, setCommittedTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [wakeDetected, setWakeDetected] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [recommendationBundles, setRecommendationBundles] = useState<
    RecommendationBundle[]
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");

  const liveTranscript = displayTranscript(
    committedTranscript,
    interimTranscript,
  );

  const pauseMicCapture = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const resumeMicCapture = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.connected) return;
    if (!recorderRef.current) {
      recorderRef.current = await startPcmRecorder((chunk) => {
        client.sendAudio(chunk);
      });
    }
  }, []);

  const MIC_RESUME_DELAY_MS = 400;

  const tryResumeAfterTts = useCallback(() => {
    if (!pendingResumeRef.current || ttsPlayingRef.current) return;
    void whenTtsQueueIdle().then(() => {
      if (!pendingResumeRef.current || ttsPlayingRef.current) return;
      window.setTimeout(() => {
        if (!pendingResumeRef.current || ttsPlayingRef.current) return;
        pendingResumeRef.current = false;
        void resumeMicCapture();
      }, MIC_RESUME_DELAY_MS);
    });
  }, [resumeMicCapture]);

  const ensureClient = useCallback((): VoiceClient => {
    if (!clientRef.current) {
      clientRef.current = new VoiceClient({
        onOpen: () => setConnected(true),
        onClose: () => {
          setConnected(false);
          setSttReady(false);
          setMicState("idle");
          pauseMicCapture();
        },
        onMessage: (msg) => handleServerMessageRef.current?.(msg),
        onTtsAudio: (buffer) => {
          enqueueMp3Buffer(buffer);
          void whenTtsQueueIdle().then(() => tryResumeAfterTtsRef.current?.());
        },
        onError: (err) => setError(err),
      });
    }
    return clientRef.current;
  }, [pauseMicCapture]);

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "status":
          if (msg.stt_ready !== undefined) setSttReady(msg.stt_ready);
          if (msg.tts_interrupted) {
            stopTts();
            ttsPlayingRef.current = false;
            setTtsPlaying(false);
          }
          if (msg.tts_playing !== undefined) {
            ttsPlayingRef.current = msg.tts_playing;
            setTtsPlaying(msg.tts_playing);
          }
          if (msg.processing !== undefined) setProcessing(msg.processing);
          if (msg.connected) setConnected(true);
          if (msg.stt_ready) sttReadyResolveRef.current?.();
          if (msg.ready_for_next) {
            pendingResumeRef.current = true;
            committedRef.current = "";
            interimRef.current = "";
            setCommittedTranscript("");
            setInterimTranscript("");
            tryResumeAfterTts();
          }
          break;
        case "transcript": {
          if (ttsPlayingRef.current && msg.interim && msg.interim.split(" ").length >= 2) {
            stopTts();
          }
          if (msg.committed !== undefined) {
            committedRef.current = msg.committed;
            setCommittedTranscript(msg.committed);
          }
          if (msg.interim !== undefined) {
            interimRef.current = msg.interim;
            setInterimTranscript(msg.interim);
          }
          if (
            msg.committed === undefined &&
            msg.interim === undefined &&
            msg.text
          ) {
            if (msg.is_final) {
              committedRef.current = `${committedRef.current} ${msg.text}`.trim();
              interimRef.current = "";
              setCommittedTranscript(committedRef.current);
              setInterimTranscript("");
            } else {
              interimRef.current = msg.text;
              setInterimTranscript(msg.text);
            }
          }
          break;
        }
        case "wake_word":
          if (msg.detected) setWakeDetected(true);
          break;
        case "chat_response": {
          const userText = msg.user_message ?? committedRef.current.trim();
          committedRef.current = "";
          interimRef.current = "";
          setCommittedTranscript("");
          setInterimTranscript("");

          setTurns((prev) => {
            if (
              msg.greeting &&
              prev.some((t) => t.role === "assistant" && t.content === msg.reply)
            ) {
              return prev;
            }
            const next = [...prev];
            if (userText) next.push({ role: "user", content: userText });
            const last = next[next.length - 1];
            if (
              last?.role === "assistant" &&
              last.content === msg.reply &&
              !userText
            ) {
              return next;
            }
            next.push({ role: "assistant", content: msg.reply });
            return next;
          });

          setMessages((prev) => {
            const next = [...prev];
            if (userText) next.push({ role: "user", content: userText });
            next.push({ role: "assistant", content: msg.reply });
            return next;
          });

          if (msg.recommendations.length > 0 && userText) {
            setRecommendationBundles((prev) =>
              appendRecommendationBundle(prev, userText, msg.recommendations),
            );
          }
          setProcessing(false);
          break;
        }
        case "error":
          setError(msg.message);
          setProcessing(false);
          sttRejectRef.current?.(new Error(msg.message));
          sttRejectRef.current = null;
          sttReadyResolveRef.current = null;
          break;
      }
    },
    [pauseMicCapture, tryResumeAfterTts],
  );

  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
    tryResumeAfterTtsRef.current = tryResumeAfterTts;
  }, [handleServerMessage, tryResumeAfterTts]);

  const waitForStt = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        sttReadyResolveRef.current = null;
        sttRejectRef.current = null;
        reject(new Error("Speech recognition timed out. Restart the backend."));
      }, 20000);
      sttReadyResolveRef.current = () => {
        window.clearTimeout(timer);
        sttReadyResolveRef.current = null;
        sttRejectRef.current = null;
        resolve();
      };
      sttRejectRef.current = (err) => {
        window.clearTimeout(timer);
        sttReadyResolveRef.current = null;
        sttRejectRef.current = null;
        reject(err);
      };
    });
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    committedRef.current = "";
    interimRef.current = "";
    setCommittedTranscript("");
    setInterimTranscript("");
    setMicState("connecting");

    try {
      const client = ensureClient();
      if (!client.connected) {
        await client.connect();
      }
      client.startListening();
      await waitForStt();
      playReadyTone();
      await resumeMicCapture();
      setMicState("connected");
      pendingResumeRef.current = false;
    } catch (e) {
      setMicState("idle");
      setError(e instanceof Error ? e.message : "Could not connect");
    }
  }, [ensureClient, waitForStt, resumeMicCapture]);

  const disconnect = useCallback(() => {
    stopTts();
    pendingResumeRef.current = false;
    pauseMicCapture();
    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnected(false);
    setSttReady(false);
    setMicState("idle");
    setWakeDetected(false);
    setProcessing(false);
    committedRef.current = "";
    interimRef.current = "";
    setCommittedTranscript("");
    setInterimTranscript("");
  }, [pauseMicCapture]);

  /** Mic button: connect when offline, disconnect when connected. */
  const toggleConnection = useCallback(async () => {
    if (micState === "connecting") return;
    if (connected || micState === "connected") {
      disconnect();
      return;
    }
    await connect();
  }, [micState, connected, connect, disconnect]);

  const sendText = useCallback(async () => {
    const content = textInput.trim();
    if (!content) return;

    setError(null);
    setProcessing(true);
    setTextInput("");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setTurns((prev) => [...prev, { role: "user", content }]);

    try {
      const res = await postChat(nextMessages);
      setTurns((prev) => [...prev, { role: "assistant", content: res.reply }]);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.recommendations.length > 0) {
        setRecommendationBundles((prev) =>
          appendRecommendationBundle(prev, content, res.recommendations),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setProcessing(false);
    }
  }, [messages, textInput]);

  const resetConversation = useCallback(() => {
    clientRef.current?.reset();
    stopTts();
    pendingResumeRef.current = false;
    disconnect();
    setMessages([]);
    setTurns([]);
    setRecommendationBundles([]);
  }, [disconnect]);

  return {
    connected,
    micState,
    sttReady,
    liveTranscript,
    turns,
    wakeDetected,
    ttsPlaying,
    processing,
    recommendationBundles,
    messages,
    error,
    textInput,
    setTextInput,
    toggleConnection,
    disconnect,
    sendText,
    resetConversation,
  };
}
