export type Recommendation = {
  name: string;
  url: string;
  test_type: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Mic button: idle → connecting → connected (listen/speak handled automatically). */
export type MicState = "idle" | "connecting" | "connected";

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

/** One role's SHL shortlist — shown as its own card in the UI. */
export type RecommendationBundle = {
  id: string;
  roleTitle: string;
  userMessage: string;
  recommendations: Recommendation[];
};

export type ServerMessage =
  | {
      type: "status";
      connected?: boolean;
      stt_ready?: boolean;
      mode?: string;
      listening?: boolean;
      tts_playing?: boolean;
      processing?: boolean;
      ready_for_next?: boolean;
      tts_interrupted?: boolean;
      message?: string;
      reset?: boolean;
    }
  | {
      type: "transcript";
      committed?: string;
      interim?: string;
      text?: string;
      is_final?: boolean;
    }
  | { type: "wake_word"; detected: boolean }
  | {
      type: "chat_response";
      reply: string;
      recommendations: Recommendation[];
      end_of_conversation: boolean;
      user_message?: string;
      greeting?: boolean;
    }
  | { type: "error"; message: string };

export type ClientControlMessage =
  | { type: "start_listening" }
  | { type: "stop_listening" }
  | { type: "reset" };
