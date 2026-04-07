"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useTasks } from "@/components/TasksProvider";
import { supabase } from "@/lib/supabase";
import {
  calculateCookedScore,
  getBestRecoveryAction,
  type StudyBlock,
} from "@/lib/calculateCookedScore";
import {
  createBossesFromTasks,
  generateRecoveryMission,
  getInitialGamificationState,
  getLevelProgress,
  loadGamificationState,
  saveGamificationState,
  updateLeagueForWeek,
  type BossBattle,
  type GamificationState,
  type RecoveryMission,
} from "@/lib/gamification";
import CookedScoreHero from "@/components/gamification/CookedScoreHero";
import LeagueCard from "@/components/gamification/LeagueCard";
import RecoveryMissionCard from "@/components/gamification/RecoveryMissionCard";
import BossBattleCard from "@/components/gamification/BossBattleCard";
import {
  Trophy,
  Flame,
  Sparkles,
  ClipboardList,
  CalendarDays,
  BarChart3,
  ChevronRight,
  Crown,
  Target,
  Zap,
} from "lucide-react";

type Priority = "High" | "Medium" | "Low";

type HomeTask = {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

type DatabaseTask = {
  id: string;
  user_id: string;
  title: string;
  module: string;
  due_date: string;
  priority: Priority;
  completed: boolean;
  created_at: string;
};

type FriendLeaderboardEntry = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  xp_total: number | null;
  cooked_score: number | null;
  streak_days: number | null;
};

const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function safeParseArray<T>(value: string | null, fallback: T[]): T[] {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function formatDueText(dateString: string) {
  const days = getDaysUntil(dateString);

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days}d left`;
}

function getCookedHeadline(score: number) {
  if (score >= 80) return "You are seriously locked in";
  if (score >= 60) return "You are in a decent spot";
  if (score >= 40) return "You are flirting with danger";
  return "You are getting cooked";
}

function getCookedStatus(score: number) {
  if (score >= 80) {
    return "Momentum is strong. Keep pressing while you are ahead.";
  }

  if (score >= 60) {
    return "You are stable, but a few missed sessions could swing this fast.";
  }

  if (score >= 40) {
    return "Deadlines are creeping up. Time to recover before it snowballs.";
  }

  return "Urgent recovery mode. Clear overdue work and lock in tonight.";
}

export default function HomePage() {
  const { tasks } = useTasks();

  const [studyPlan, setStudyPlan] = useState<StudyBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendLeaderboard, setFriendLeaderboard] = useState<FriendLeaderboardEntry[]>([]);
  const [gameState, setGameState] = useState<GamificationState>(getInitialGamificationState());

  useEffect(() => {
    const storedStudyPlan = safeParseArray<StudyBlock>(
      localStorage.getItem(STUDY_PLAN_STORAGE_KEY),
      []
    );
    setStudyPlan(storedStudyPlan);

    const storedGame = loadGamificationState();
    setGameState(storedGame);
  }, []);

  useEffect(() => {
    saveGamificationState(gameState);
  }, [gameState]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: friendsData } = await supabase
        .from("friends")
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");

      const friendIds = new Set<string>();
      (friendsData ?? []).forEach((friendship) => {
        if (friendship.requester_id === user.id) {
          friendIds.add(friendship.addressee_id);
        } else {
          friendIds.add(friendship.requester_id);
        }
      });
      friendIds.add(user.id);

      const ids = Array.from(friendIds);

      let leaderboardRows: FriendLeaderboardEntry[] = [];

      if (ids.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);

        const { data: leaderboardRowsRaw } = await supabase
          .from("leaderboard")
          .select("user_id, xp_total, cooked_score, streak_days")
          .in("user_id", ids);

        leaderboardRows = ids.map((id) => {
          const profile = (profileRows ?? []).find((row) => row.id === id);
          const board = (leaderboardRowsRaw ?? []).find((row) => row.user_id === id);

          return {
            id,
            display_name: profile?.display_name ?? null,
            username: profile?.username ?? null,
            avatar_url: profile?.avatar_url ?? null,
            xp_total: board?.xp_total ?? 0,
            cooked_score: board?.cooked_score ?? 0,
            streak_days: board?.streak_days ?? 0,
          };
        });

        leaderboardRows.sort((a, b) => (b.xp_total ?? 0) - (a.xp_total ?? 0));
      }

      if (!active) return;

      setFriendLeaderboard(leaderboardRows);
      setLoading(false);
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const homeTasks = useMemo<HomeTask[]>(() => {
    return tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate,
    }));
  }, [tasks]);

  const incompleteTasks = useMemo(
    () => homeTasks.filter((task) => !task.completed),
    [homeTasks]
  );

  const upcomingTasks = useMemo(() => {
    return [...incompleteTasks]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4);
  }, [incompleteTasks]);

  const todaysStudyBlocks = useMemo(() => {
    const todayName = new Date().toLocaleDateString("en-GB", { weekday: "long" });
    return studyPlan.filter((block) => block.day === todayName);
  }, [studyPlan]);

  const cookedResult = useMemo(() => {
    return calculateCookedScore(homeTasks, studyPlan);
  }, [homeTasks, studyPlan]);

  const bestRecoveryAction = useMemo(() => {
    return getBestRecoveryAction(homeTasks, studyPlan);
  }, [homeTasks, studyPlan]);

  useEffect(() => {
    const bosses: BossBattle[] = createBossesFromTasks(
      incompleteTasks.map((task) => ({
        id: task.id,
        title: task.title,
        module: task.module,
        dueDate: task.dueDate,
        priority: task.priority,
        completed: task.completed,
      }))
    );

    const mission: RecoveryMission | null = generateRecoveryMission(
      incompleteTasks.map((task) => ({
        id: task.id,
        title: task.title,
        module: task.module,
        dueDate: task.dueDate,
        priority: task.priority,
        completed: task.completed,
      })),
      cookedResult.score
    );

    setGameState((prev) => ({
      ...prev,
      bosses,
      missions: mission ? [mission] : prev.missions.filter((m) => m.status === "active"),
      league: updateLeagueForWeek(prev.league, prev.stats.weeklyXp),
    }));
  }, [incompleteTasks, cookedResult.score]);

  const levelProgress = useMemo(() => {
    return getLevelProgress(gameState.stats.xp);
  }, [gameState.stats.xp]);

  const activeMission = gameState.missions.find((mission) => mission.status === "active") ?? null;
  const topBoss = gameState.bosses[0] ?? null;

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70 backdrop-blur">
            Loading LockdIn...
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
        <CookedScoreHero
          score={cookedResult.score}
          headline={getCookedHeadline(cookedResult.score)}
          status={getCookedStatus(cookedResult.score)}
          xp={gameState.stats.xp}
          level={gameState.stats.level}
          streakDays={gameState.stats.streakDays}
          percentToNextLevel={levelProgress.percent}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Friend Leaderboard
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-white">
                    See who is really locked in
                  </h2>
                </div>

                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10"
                >
                  Full board
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {friendLeaderboard.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/60">
                    No leaderboard data yet. Add friends and start earning XP.
                  </div>
                ) : (
                  friendLeaderboard.slice(0, 5).map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white">
                          {entry.avatar_url ? (
                            <Image
                              src={entry.avatar_url}
                              alt={entry.display_name ?? "User avatar"}
                              width={44}
                              height={44}
                              className="h-11 w-11 rounded-2xl object-cover"
                            />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-white">
                            {entry.display_name || entry.username || "Unknown user"}
                          </p>
                          <p className="text-sm text-white/50">
                            {entry.username ? `@${entry.username}` : "LockdIn user"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {entry.xp_total ?? 0} XP
                          </p>
                          <p className="text-xs text-white/50">
                            {entry.cooked_score ?? 0}% score • {entry.streak_days ?? 0} day streak
                          </p>
                        </div>

                        {index === 0 && (
                          <div className="rounded-full bg-yellow-500/15 p-2 text-yellow-300">
                            <Crown className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <LeagueCard
                tier={gameState.league.tier}
                weeklyXp={gameState.stats.weeklyXp}
                weeklyRank={gameState.league.weeklyRank}
                percentile={gameState.league.percentile}
              />

              <RecoveryMissionCard mission={activeMission} />
            </div>

            <BossBattleCard boss={topBoss} />

            <section className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Upcoming Tasks
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-white">
                    Deadlines you cannot ignore
                  </h2>
                </div>

                <Link
                  href="/tasks"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10"
                >
                  Open tasks
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {upcomingTasks.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/60">
                    No upcoming tasks. You are weirdly calm right now.
                  </div>
                ) : (
                  upcomingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div>
                        <p className="font-semibold text-white">{task.title}</p>
                        <p className="text-sm text-white/50">{task.module}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatDueText(task.dueDate)}
                        </p>
                        <p className="text-xs text-white/50">{task.priority} priority</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/5 p-3 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Best Recovery Move
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Your highest impact next step
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    {bestRecoveryAction
                      ? `${bestRecoveryAction.label} could improve your score immediately.`
                      : "No urgent recovery action right now."}
                  </p>

                  {bestRecoveryAction && (
                    <Link
                      href={bestRecoveryAction.route}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
                    >
                      Fix this now
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Today’s Study Plan
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Your sessions for today
                  </h2>
                </div>

                <Link
                  href="/planner"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10"
                >
                  Open planner
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {todaysStudyBlocks.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/60">
                    No study blocks for today yet. Add one before you drift.
                  </div>
                ) : (
                  todaysStudyBlocks.slice(0, 4).map((block) => (
                    <div
                      key={block.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{block.subject}</p>
                          <p className="text-sm text-white/50">{block.focus}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{block.time}</p>
                          <p className="text-xs text-white/50">
                            {block.duration_minutes} mins
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
                <div className="flex items-center gap-2 text-white/55">
                  <ClipboardList className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">Tasks</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-white">{homeTasks.length}</p>
                <p className="mt-1 text-sm text-white/50">
                  {incompleteTasks.length} still active
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
                <div className="flex items-center gap-2 text-white/55">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">
                    Study Blocks
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold text-white">{studyPlan.length}</p>
                <p className="mt-1 text-sm text-white/50">
                  {todaysStudyBlocks.length} scheduled today
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
                <div className="flex items-center gap-2 text-white/55">
                  <Flame className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">Streak</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-white">
                  {gameState.stats.streakDays}
                </p>
                <p className="mt-1 text-sm text-white/50">Keep the run alive</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-xl">
                <div className="flex items-center gap-2 text-white/55">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">Level</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-white">
                  {gameState.stats.level}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {gameState.stats.xp} total XP
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/5 p-3 text-white">
                  <Zap className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Brand Hook
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Don’t get cooked this semester
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-white/60">
                    Your score, XP, streak, and leaderboard position now all push the same
                    loop: survive, recover, and flex.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}