"use client";

import { Crown, Trophy, Medal, Sparkles } from "lucide-react";
import type { LeagueTier } from "@/lib/gamification";

type Props = {
  tier: LeagueTier;
  weeklyXp: number;
  weeklyRank: number | null;
  percentile: number | null;
};

function getTierIcon(tier: LeagueTier) {
  switch (tier) {
    case "Locked In":
      return <Crown className="h-5 w-5" />;
    case "Elite":
      return <Sparkles className="h-5 w-5" />;
    case "Gold":
      return <Trophy className="h-5 w-5" />;
    case "Silver":
      return <Medal className="h-5 w-5" />;
    default:
      return <Medal className="h-5 w-5" />;
  }
}

export default function LeagueCard({
  tier,
  weeklyXp,
  weeklyRank,
  percentile,
}: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Weekly League
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">{tier}</h3>
          <p className="mt-1 text-sm text-white/55">
            Earn XP this week to climb your tier.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white">
          {getTierIcon(tier)}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">Weekly XP</p>
          <p className="mt-2 text-lg font-bold text-white">{weeklyXp}</p>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">Rank</p>
          <p className="mt-2 text-lg font-bold text-white">
            {weeklyRank ? `#${weeklyRank}` : "--"}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">%ile</p>
          <p className="mt-2 text-lg font-bold text-white">
            {percentile !== null ? `${percentile}%` : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}