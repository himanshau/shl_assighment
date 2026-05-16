"use client";

type Props = {
  live: string;
  finalText: string;
  visible: boolean;
};

export function LiveTranscript({ live, finalText, visible }: Props) {
  if (!visible && !live && !finalText) return null;

  return (
    <section className="mx-auto mt-6 max-w-5xl rounded-2xl border border-[#2A3A4D] bg-[#0A1114] px-5 py-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#A855F7]">
        Live transcript
      </h2>
      <p className="min-h-[1.5rem] text-base text-white">
        {live || (
          <span className="text-[#64748B]">Listening…</span>
        )}
      </p>
      {finalText ? (
        <p className="mt-3 border-t border-[#1E1B4B] pt-3 text-sm text-[#94A3B8]">
          Final: {finalText}
        </p>
      ) : null}
    </section>
  );
}
