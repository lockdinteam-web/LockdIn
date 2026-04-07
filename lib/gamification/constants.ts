import type { GamificationState } from "./types";

export const GAME_STORAGE_KEY = "lockdin_gamification_state";

export const XP_VALUES = {
  TASK_LOW: 15,
  TASK_MEDIUM: 25,
  TASK_HIGH: 40,
  STUDY_BLOCK_30: 20,
  STUDY_BLOCK_60: 35,
  STUDY_BLOCK_90: 55,
  EARLY_BONUS: 15,
  RECOVERY_MISSION: 80,
  LEAGUE_PROMOTION: 120,
  BOSS_HIT: 10,
  STREAK_SAVE_COST: 150,
} as const;

export const LEVEL_STEP = 100;

export const DEFAULT_GAME_STATE: GamificationState = {
  stats: {
    xp: 0,
    level: 1,
    streakDays: 0,
    streakSavesAvailable: 1,
    weeklyXp: 0,
    totalCompletedTasks: 0,
    totalCompletedStudyBlocks: 0,
    lastActiveDate: null,
  },
  league: {
    tier: "Bronze",
    weeklyRank: null,
    percentile: null,
    promotedLastWeek: false,
    demotedLastWeek: false,
    weekKey: "",
  },
  bosses: [],
  missions: [],
  recentXpEvents: [],
  lastShareMoment: null,
};