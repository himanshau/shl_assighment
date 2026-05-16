"use client";

import type { RecommendationBundle } from "@/lib/types";

type Props = {
  bundles: RecommendationBundle[];
};

const TECH_COLORS: Record<string, string> = {
  python: "from-emerald-900/40 to-[#0A1114] border-emerald-500/40",
  java: "from-orange-900/30 to-[#0A1114] border-orange-500/40",
  javascript: "from-amber-900/30 to-[#0A1114] border-amber-500/40",
  default: "from-[#1a1030] to-[#0A1114] border-[#7A3ACA]/50",
};

function cardAccent(title: string): string {
  const lower = title.toLowerCase();
  for (const key of Object.keys(TECH_COLORS)) {
    if (key !== "default" && lower.includes(key)) {
      return TECH_COLORS[key];
    }
  }
  return TECH_COLORS.default;
}

export function RecommendationsBoard({ bundles }: Props) {
  if (!bundles.length) return null;

  return (
    <div className="mx-auto mt-6 w-full max-w-5xl px-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
        Assessment shortlists by role
      </h3>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {bundles.map((bundle, index) => (
          <article
            key={bundle.id}
            className={`w-[min(100%,340px)] shrink-0 snap-start overflow-hidden rounded-2xl border bg-gradient-to-br shadow-lg ${cardAccent(bundle.roleTitle)}`}
          >
            <header className="border-b border-white/10 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A855F7]">
                    Role {index + 1}
                  </p>
                  <h4 className="mt-0.5 text-base font-semibold text-white">
                    {bundle.roleTitle}
                  </h4>
                </div>
                <span className="shrink-0 rounded-full bg-[#7A3ACA]/30 px-2 py-0.5 text-[10px] font-medium text-[#C4B5FD]">
                  {bundle.recommendations.length} tests
                </span>
              </div>
              {bundle.userMessage ? (
                <p className="mt-2 text-xs italic text-[#64748B] line-clamp-2">
                  &ldquo;{bundle.userMessage}&rdquo;
                </p>
              ) : null}
            </header>
            <ul className="max-h-[280px] divide-y divide-[#2A3A4D]/80 overflow-y-auto px-2 py-1">
              {bundle.recommendations.map((rec) => (
                <li key={`${bundle.id}-${rec.url}`} className="px-2 py-2.5">
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#55AFF2] hover:underline"
                  >
                    {rec.name}
                  </a>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Type: {rec.test_type || "—"}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
