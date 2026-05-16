"use client";

import { ChatThread } from "@/components/copilot/ChatThread";
import { DashboardHero } from "@/components/copilot/DashboardHero";
import { LiveTranscript } from "@/components/copilot/LiveTranscript";
import { RecommendationsBoard } from "@/components/copilot/RecommendationsBoard";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";

export default function Home() {
  const agent = useVoiceAgent();
  const showTranscript =
    agent.connected &&
    (Boolean(agent.liveTranscript) || agent.processing || agent.ttsPlaying);

  return (
    <div className="min-h-screen bg-[#0E171B] pb-12">
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <DashboardHero
          connected={agent.connected}
          micState={agent.micState}
          processing={agent.processing}
          ttsPlaying={agent.ttsPlaying}
          wakeDetected={agent.wakeDetected}
          onMicClick={agent.toggleConnection}
        />

        <LiveTranscript
          live={agent.liveTranscript}
          finalText=""
          visible={showTranscript}
        />

        <div className="mt-8">
          <ChatThread
            turns={agent.turns}
            liveTranscript={agent.liveTranscript}
            recording={agent.connected && !agent.ttsPlaying && !agent.processing}
            processing={agent.processing}
          />
          <RecommendationsBoard bundles={agent.recommendationBundles} />
        </div>

        {agent.error ? (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-sm text-red-300">
            {agent.error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <input
            type="text"
            value={agent.textInput}
            onChange={(e) => agent.setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agent.sendText()}
            placeholder="Or type your hiring requirement…"
            className="w-full max-w-md rounded-full border border-[#1D222A] bg-[#0A1114] px-4 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none"
          />
          <button
            type="button"
            onClick={agent.sendText}
            className="rounded-full bg-[#7A3ACA] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Send
          </button>
          <button
            type="button"
            onClick={agent.resetConversation}
            className="rounded-full border border-[#2A3A4D] px-5 py-2.5 text-sm text-[#94A3B8]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
