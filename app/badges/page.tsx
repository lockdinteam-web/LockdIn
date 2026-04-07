"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { Trophy, Lock, Sparkles } from "lucide-react";

type BadgeKey = "first_task" | "xp_500" | "streak_7";

type BadgeRow = {
  badge_key: BadgeKey;
  unlocked_at?: string;
};

const badgeMeta: Record<
  BadgeKey,
  {
    title: string;
    description: string;
    icon: string;
    color: string;
  }
> = {
  first_task: {
    title: "First Win",
    description: "Complete your first task.",
    icon: "🎯",
    color: "from-blue-500/20 to-cyan-500/20 border-blue-400/20",
  },
  xp_500: {
    title: "Momentum Builder",
    description: "Reach 500 total XP.",
    icon: "⚡",
    color: "from-purple-500/20 to-pink-500/20 border-purple-400/20",
  },
  streak_7: {
    title: "Locked In",
    description: "Maintain a 7 day streak.",
    icon: "🔥",
    color: "from-orange-500/20 to-rose-500/20 border-orange-400/20",
  },
};

const allBadges: BadgeKey[] = ["first_task", "xp_500", "streak_7"];

export default function BadgesPage() {
  const [unlockedBadges, setUnlockedBadges] = useState<BadgeKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBadges() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("badges")
        .select("badge_key, unlocked_at")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error loading badges:", error.message);
        setLoading(false);
        return;
      }

      setUnlockedBadges((data as BadgeRow[]).map((b) => b.badge_key));
      setLoading(false);
    }

    loadBadges();
  }, []);

  const progress = useMemo(() => {
    return Math.round((unlockedBadges.length / allBadges.length) * 100);
  }, [unlockedBadges]);

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#08122b_0%,#061021_100%)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/15 p-3">
                <Trophy className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                  Progress
                </p>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight">
                  Your Badges
                </h1>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Unlock milestones as you stay consistent, complete work, and build
              momentum inside LockdIn.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Collection Progress</p>
                <p className="text-sm text-slate-300">
                  {unlockedBadges.length}/{allBadges.length}
                </p>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${Math.max(6, progress)}%` }}
                />
              </div>
            </div>
          </section>

          {loading ? (
            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8 text-slate-400">
              Loading badges...
            </div>
          ) : (
            <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {allBadges.map((badgeKey) => {
                const unlocked = unlockedBadges.includes(badgeKey);
                const badge = badgeMeta[badgeKey];

                return (
                  <div
                    key={badgeKey}
                    className={`rounded-3xl border bg-gradient-to-br p-6 transition ${
                      unlocked
                        ? badge.color
                        : "border-slate-800 from-slate-900 to-slate-900 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-4xl">{badge.icon}</div>

                      {unlocked ? (
                        <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                          Unlocked
                        </div>
                      ) : (
                        <div className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                          Locked
                        </div>
                      )}
                    </div>

                    <h2 className="mt-5 text-2xl font-semibold">
                      {badge.title}
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {badge.description}
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
                      {unlocked ? (
                        <>
                          <Sparkles className="h-4 w-4 text-amber-300" />
                          Achievement earned
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Keep going
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}