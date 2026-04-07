"use client";

import { Target, Zap } from "lucide-react";
import type { RecoveryMission } from "@/lib/gamification";

type Props = {
  mission: RecoveryMission | null;
};

function labelForGoal(goal: RecoveryMission["goals"][number]) {
  if (goal.type === "complete_overdue_task") {
    return "Overdue tasks cleared";
  }

  if (goal.type === "complete_task") {
    return "Tasks completed";
  }

  return "Study minutes";
}

export default function RecoveryMissionCard({ mission }: Props) {
  if (!mission) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/5 p-3 text-white">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Recovery Mission</p>
            <p className="text-sm text-white/55">
              No active mission right now. Keep stacking XP.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-amber-400/15 bg-[#111827] p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/70">
            Clutch Mode
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">{mission.title}</h3>
          <p className="mt-1 text-sm text-white/55">{mission.description}</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
          <Zap className="h-4 w-4" />
          +{mission.rewardXp} XP
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {mission.goals.map((goal, index) => {
          const percent = Math.max(
            0,
            Math.min(100, Math.round((goal.current / goal.target) * 100))
          );

          return (
            <div key={`${goal.type}-${index}`} className="rounded-2xl bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-white">{labelForGoal(goal)}</span>
                <span className="text-white/55">
                  {goal.current}/{goal.target}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-300 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}