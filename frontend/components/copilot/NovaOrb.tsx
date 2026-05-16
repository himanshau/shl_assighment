"use client";

type Props = {
  active: boolean;
};

const BARS = [30, 10, 16, 20, 5, 30, 10, 20, 16, 5, 23, 10, 16, 30, 16, 5, 23, 10, 16, 30];

export function NovaOrb({ active }: Props) {
  return (
    <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center">
      <div
        className={`orb-glow absolute inset-0 rounded-full bg-gradient-to-br from-[#75cffe] via-[#5085d9] to-[#2d30e4] shadow-[0_0_40px_rgba(96,165,250,0.45)] ${active ? "opacity-100" : "opacity-70"}`}
      />
      <div className="relative z-10 flex h-[70px] items-end justify-center gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`w-[2.5px] rounded-full bg-[#67e8f9] ${active ? "wave-bar" : ""}`}
            style={{
              height: active ? undefined : `${h}px`,
              animationDelay: active ? `${i * 0.05}s` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
