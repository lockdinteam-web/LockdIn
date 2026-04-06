"use client";

import Link from "next/link";
import type { CookedResult } from "@/lib/calculateCookedScore";

type Props = {
  cooked: CookedResult;
};

function getScoreTextColor(score: number) {
  if (score <= 20) return "text-green-400";
  if (score <= 40) return "text-emerald-400";
  if (score <= 60) return "text-yellow-400";
  if (score <= 80) return "text-orange-400";
  return "text-red-400";
}

function getScoreBarWidth(score: number) {
  return `${Math.max(6, Math.min(100, score))}%`;
}

export default function CookedScoreCard({ cooked }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">
            How Cooked Am I?
          </p>

          <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
            Academic Risk Score
          </h1>

          <div className="mt-5 flex items-end gap-3">
            <span className={`text-5xl font-bold md:text-6xl ${getScoreTextColor(cooked.score)}`}>
              {cooked.score}
            </span>
            <span className="pb-2 text-xl text-white/35">/ 100</span>
          </div>

          <p className="mt-3 text-lg font-medium text-white/85">
            Status: {cooked.status}
          </p>

          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 md:text-base">
            {cooked.headline}
          </p>

          <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/80 transition-all duration-500"
              style={{ width: getScoreBarWidth(cooked.score) }}
            />
          </div>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white/70">What’s driving it</p>

          <ul className="mt-4 space-y-3 text-sm text-white/85">
            {cooked.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-[6px] h-2 w-2 rounded-full bg-white/60" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/planner"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:scale-[1.01]"
          >
            Reduce My Score
          </Link>
        </div>
      </div>
    </section>
  );
}