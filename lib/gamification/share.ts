import type { ShareMoment, ShareMomentType } from "./types";

export function createShareMoment(input: {
  type: ShareMomentType;
  title: string;
  subtitle: string;
  score: number;
  xp: number;
  streakDays: number;
}): ShareMoment {
  return {
    ...input,
    createdAt: new Date().toISOString(),
  };
}