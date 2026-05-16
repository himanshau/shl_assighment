import { getWsUrl } from "@/lib/config";
import type { ClientControlMessage, ServerMessage } from "@/lib/types";

export type VoiceClientCallbacks = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (msg: ServerMessage) => void;
  onTtsAudio?: (buffer: ArrayBuffer) => void;
  onError?: (err: string) => void;
};

export class VoiceClient {
  private ws: WebSocket | null = null;
  private callbacks: VoiceClientCallbacks;
  private connectPromise: Promise<void> | null = null;

  constructor(callbacks: VoiceClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      const timeout = window.setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timed out"));
      }, 10000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        this.ws = ws;
        this.callbacks.onOpen?.();
        resolve();
      };

      ws.onclose = () => {
        window.clearTimeout(timeout);
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
          const parsed = JSON.parse(event.data as string) as ServerMessage;
          this.callbacks.onMessage?.(parsed);
        } catch {
          this.callbacks.onError?.("Invalid server message");
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        this.connectPromise = null;
        const err = `WebSocket failed (${url}). Is the backend running on port 8000?`;
        this.callbacks.onError?.(err);
        reject(new Error(err));
      };
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.sendControl({ type: "stop_listening" });
    this.ws?.close();
    this.ws = null;
    this.connectPromise = null;
  }

  sendControl(msg: ClientControlMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(chunk);
  }

  startListening(): void {
    this.sendControl({ type: "start_listening" });
  }

  reset(): void {
    this.sendControl({ type: "reset" });
  }
}
