"use client";

type Props = {
  connected: boolean;
  onReset: () => void;
};

export function CopilotFooter({ connected, onReset }: Props) {
  const steps = [1, 2, 3, 4, 5, 6];

  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-[#1E1B4B] bg-[#0E171B] px-6 py-5">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-[#A855F7]" />
          <span className="text-white">Current agent:</span>
          <span className="text-[#D7AEFF]">Nova</span>
          <span className="ml-2 text-[#64748B]">
            {connected ? "● Live" : "○ Offline"}
          </span>
        </div>

        <div className="flex gap-1.5">
          {steps.map((s) => (
            <span
              key={s}
              className={`h-1.5 w-7 rounded-full ${
                s <= 2 ? "bg-[#7A3ACA]" : "bg-[#64748B]"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-[#7A3ACA] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_8px_#955ADD]"
        >
          Reset →
        </button>
      </div>
    </footer>
  );
}
