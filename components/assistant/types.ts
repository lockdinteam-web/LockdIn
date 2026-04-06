export type Scenario =
  | "no_reply"
  | "mixed_signals"
  | "cancelled_plans"
  | "breadcrumbing"
  | "late_night_only"
  | "ghost_return"
  | "love_bombing"
  | "inconsistent_effort";

export type RiskLevel = "low" | "caution" | "high";

export type AssistantInput = {
  scenario: Scenario;
  daysSinceReply?: number;
  repeatPattern?: boolean;
  gaveReason?: boolean;
  stillWatchingStories?: boolean;
  madeRealPlans?: boolean;
  onlyLateNight?: boolean;
};

export type AssistantResult = {
  verdict: string;
  risk: RiskLevel;
  summary: string;
  reasoning: string[];
  nextStep: string;
  avoid: string;
};