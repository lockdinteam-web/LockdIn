import type { LeagueState, LeagueTier } from "./types";

const ORDER: LeagueTier[] = ["Bronze", "Silver", "Gold", "Elite", "Locked In"];

export function getCurrentWeekKey(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);

  const firstJan = new Date(copy.getFullYear(), 0, 1);
  const dayMs = 1000 * 60 * 60 * 24;
  const week = Math.ceil(
    ((copy.getTime() - firstJan.getTime()) / dayMs + firstJan.getDay() + 1) / 7
  );

  return `${copy.getFullYear()}-W${week}`;
}

export function getTierFromWeeklyXp(weeklyXp: number): LeagueTier {
  if (weeklyXp >= 700) return "Locked In";
  if (weeklyXp >= 450) return "Elite";
  if (weeklyXp >= 250) return "Gold";
  if (weeklyXp >= 100) return "Silver";
  return "Bronze";
}

export function updateLeagueForWeek(
  state: LeagueState,
  weeklyXp: number,
  date = new Date()
): LeagueState {
  const weekKey = getCurrentWeekKey(date);
  const nextTier = getTierFromWeeklyXp(weeklyXp);

  const previousIndex = ORDER.indexOf(state.tier);
  const nextIndex = ORDER.indexOf(nextTier);

  return {
    ...state,
    tier: nextTier,
    promotedLastWeek: nextIndex > previousIndex,
    demotedLastWeek: nextIndex < previousIndex,
    weekKey,
  };
}