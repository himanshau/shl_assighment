"use client";

import type { Recommendation } from "@/lib/types";

type Props = {
  items: Recommendation[];
};

export function RecommendationsList({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="mx-auto mt-4 w-full max-w-2xl px-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
        SHL recommendations
      </h3>
      <ul className="space-y-2">
        {items.map((rec) => (
          <li
            key={rec.url}
            className="rounded-xl border border-[#2A3A4D] bg-[#0A1114] px-4 py-3"
          >
            <a
              href={rec.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#55AFF2] hover:underline"
            >
              {rec.name}
            </a>
            <p className="mt-1 text-xs text-[#64748B]">Type: {rec.test_type}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
