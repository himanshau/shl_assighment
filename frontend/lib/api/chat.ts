import { API_BASE } from "@/lib/config";
import type { ChatMessage, Recommendation } from "@/lib/types";

export type ChatApiResponse = {
  reply: string;
  recommendations: Recommendation[];
  end_of_conversation: boolean;
};

export async function postChat(
  messages: ChatMessage[],
): Promise<ChatApiResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    throw new Error(`Chat API error: ${res.status}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data?.status === "ok";
  } catch {
    return false;
  }
}
