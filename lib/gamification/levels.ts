import { LEVEL_STEP } from "./constants";

export function getLevelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
}

export function getLevelProgress(xp: number) {
  const level = getLevelFromXp(xp);
  const currentLevelFloor = (level - 1) * LEVEL_STEP;
  const nextLevelFloor = level * LEVEL_STEP;
  const intoLevel = xp - currentLevelFloor;
  const needed = nextLevelFloor - currentLevelFloor;

  return {
    level,
    intoLevel,
    needed,
    percent: Math.max(0, Math.min(100, Math.round((intoLevel / needed) * 100))),
  };
}