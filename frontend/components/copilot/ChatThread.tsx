"use client";

import type { ConversationTurn } from "@/lib/types";

type Props = {
  turns: ConversationTurn[];
  liveTranscript: string;
  recording: boolean;
  processing: boolean;
};

export function ChatThread({
  turns,
  liveTranscript,
  recording,
  processing,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4">
      {turns.map((turn, i) => (
        <div
          key={`${turn.role}-${i}-${turn.content.slice(0, 24)}`}
          className={`flex gap-3 ${turn.role === "user" ? "flex-row-reverse" : ""}`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs ${
              turn.role === "user"
                ? "border-[#64748B] bg-[rgba(100,116,139,0.32)] text-[#64748B]"
                : "border-[#669EE2] bg-[rgba(102,158,226,0.32)] text-white"
            }`}
          >
            {turn.role === "user" ? "U" : "AI"}
          </div>
          <div
            className={`max-w-[85%] rounded-2xl border border-[#2A3A4D] bg-[#0A1114] px-4 py-3 text-sm leading-relaxed text-white ${
              turn.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"
            }`}
          >
            {turn.content}
          </div>
        </div>
      ))}

      {recording && liveTranscript ? (
        <div className="flex flex-row-reverse gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#669EE2] bg-[rgba(102,158,226,0.32)] text-xs">
            U
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-[#669EE2]/40 bg-[#0A1114] px-4 py-3 text-sm italic text-[#94A3B8]">
            {liveTranscript}
          </div>
        </div>
      ) : null}

      {processing ? (
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#669EE2] bg-[rgba(102,158,226,0.32)] text-xs">
            AI
          </div>
          <div className="rounded-2xl rounded-tl-sm border border-[#2A3A4D] bg-[#0A1114] px-4 py-3 text-sm text-[#94A3B8]">
            Thinking…
          </div>
        </div>
      ) : null}
    </div>
  );
}
