export type Priority = "High" | "Medium" | "Low";

export type TaskLike = {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

export type StudyBlockLike = {
  id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  task_id: string | null;
  duration_minutes: number;
  completed: boolean;
  location?: string;
};

export type XPEventType =
  | "task_complete"
  | "study_block_complete"
  | "early_submission"
  | "streak_save"
  | "recovery_mission_complete"
  | "league_promotion"
  | "boss_battle_hit";

export type XPEvent = {
  id: string;
  type: XPEventType;
  value: number;
  createdAt: string;
  label: string;
};

export type UserGameStats = {
  xp: number;
  level: number;
  streakDays: number;
  streakSavesAvailable: number;
  weeklyXp: number;
  totalCompletedTasks: number;
  totalCompletedStudyBlocks: number;
  lastActiveDate: string | null;
};

export type LeagueTier = "Bronze" | "Silver" | "Gold" | "Elite" | "Locked In";

export type LeagueState = {
  tier: LeagueTier;
  weeklyRank: number | null;
  percentile: number | null;
  promotedLastWeek: boolean;
  demotedLastWeek: boolean;
  weekKey: string;
};

export type BossBattle = {
  id: string;
  title: string;
  taskId: string;
  maxHp: number;
  currentHp: number;
  dueDate: string;
  module: string;
  isComplete: boolean;
};

export type RecoveryMissionGoal = {
  type: "complete_overdue_task" | "complete_task" | "complete_study_minutes";
  target: number;
  current: number;
};

export type RecoveryMission = {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  status: "active" | "completed";
  goals: RecoveryMissionGoal[];
  createdAt: string;
};

export type ShareMomentType =
  | "score_recovered"
  | "new_league_rank"
  | "streak_hit"
  | "most_cooked_warning"
  | "boss_defeated";

export type ShareMoment = {
  type: ShareMomentType;
  title: string;
  subtitle: string;
  score: number;
  xp: number;
  streakDays: number;
  createdAt: string;
};

export type GamificationState = {
  stats: UserGameStats;
  league: LeagueState;
  bosses: BossBattle[];
  missions: RecoveryMission[];
  recentXpEvents: XPEvent[];
  lastShareMoment: ShareMoment | null;
};