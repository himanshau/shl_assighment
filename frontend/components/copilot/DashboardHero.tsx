"use client";

import type { MicState } from "@/lib/types";

type Props = {
  connected: boolean;
  micState: MicState;
  processing: boolean;
  ttsPlaying: boolean;
  wakeDetected: boolean;
  onMicClick: () => void;
};

export function DashboardHero({
  connected,
  micState,
  processing,
  ttsPlaying,
  wakeDetected,
  onMicClick,
}: Props) {
  const busy = micState === "connecting";
  const ledOn = connected;
  const ledColor =
    micState === "connecting"
      ? "bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse"
      : ledOn
        ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
        : "bg-red-500/80 shadow-[0_0_6px_#ef4444]";

  const statusLine = (() => {
    if (micState === "connecting") return "Connecting…";
    if (!connected) return "Tap to connect";
    if (processing) return "Thinking…";
    if (ttsPlaying) return "Speaking…";
    if (wakeDetected) return "Listening — describe the role and skills";
    return "Listening — speak anytime";
  })();

  return (
    <section className="relative mx-auto max-w-5xl px-3">
      <div
        className="relative flex min-h-[197px] items-center overflow-hidden rounded-[32px] border border-[#1E1B4B] pl-6 pr-[140px]"
        style={{
          background:
            "linear-gradient(90deg, #0E171B 0%, rgba(84, 35, 129, 0) 100%)",
        }}
      >
        <div className="flex-1 py-5">
          <span className="inline-flex items-center rounded-[40px] border border-[#7A3ACA] bg-[rgba(122,58,202,0.32)] px-2.5 py-1.5 text-[11px] font-semibold text-[#A855F7]">
            HR Copilot
          </span>

          <h1
            className="mt-4 text-4xl font-bold leading-tight"
            style={{
              background:
                "linear-gradient(99.99deg, #FFFFFF -12.18%, #7A3ACA 111.92%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Hello, I&apos;m Nova.
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#64748B]">
            {connected
              ? "Multi-turn voice assistant — I clarify first, then recommend SHL assessments from the catalog."
              : "One tap connects you. Speak naturally; I respond when you pause."}
          </p>
        </div>

        <div className="absolute right-10 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] font-medium text-[#64748B]">
            <span
              className={`h-2.5 w-2.5 rounded-full transition-colors ${ledColor}`}
              title={ledOn ? "Connected" : "Disconnected"}
            />
            {micState === "connecting"
              ? "Connecting…"
              : ledOn
                ? "Connected"
                : "Offline"}
          </div>

          <button
            type="button"
            onClick={onMicClick}
            disabled={busy}
            aria-label={connected ? "Disconnect" : "Connect"}
            className={`relative flex h-[94px] w-[94px] items-center justify-center rounded-full border-2 border-[#7A3ACA] transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 ${
              connected
                ? "shadow-[0_0_30px_#6316A2,inset_0_0_20px_rgba(122,58,202,0.4)]"
                : "shadow-[0_0_25px_#6316A2,0_0_12px_#6316A2]"
            }`}
          >
            <MicIcon active={connected} />
          </button>

          <span className="max-w-[88px] text-center text-[10px] leading-tight text-[#94A3B8]">
            {statusLine}
          </span>
        </div>
      </div>
    </section>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        fill={active ? "#A855F7" : "#7A3ACA"}
      />
      <path
        d="M6 11a6 6 0 0012 0M12 17v4"
        stroke={active ? "#A855F7" : "#7A3ACA"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
