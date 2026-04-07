import { XP_VALUES } from "./constants";
import type { UserGameStats } from "./types";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function updateStreak(stats: UserGameStats, now = new Date()): UserGameStats {
  const today = startOfDay(now);
  const lastActive = stats.lastActiveDate
    ? startOfDay(new Date(stats.lastActiveDate))
    : null;

  if (!lastActive) {
    return {
      ...stats,
      streakDays: 1,
      lastActiveDate: now.toISOString(),
    };
  }

  const diffDays = Math.round(
    (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return {
      ...stats,
      lastActiveDate: now.toISOString(),
    };
  }

  if (diffDays === 1) {
    return {
      ...stats,
      streakDays: stats.streakDays + 1,
      lastActiveDate: now.toISOString(),
    };
  }

  if (diffDays > 1 && stats.streakSavesAvailable > 0 && stats.xp >= XP_VALUES.STREAK_SAVE_COST) {
    return {
      ...stats,
      xp: stats.xp - XP_VALUES.STREAK_SAVE_COST,
      streakSavesAvailable: stats.streakSavesAvailable - 1,
      lastActiveDate: now.toISOString(),
    };
  }

  return {
    ...stats,
    streakDays: 1,
    lastActiveDate: now.toISOString(),
  };
}