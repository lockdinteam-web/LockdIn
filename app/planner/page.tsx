"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Trash2,
  CalendarDays,
  BookOpen,
  Flag,
  Trophy,
  Flame,
  Sparkles,
  Target,
  Zap,
  Clock3,
} from "lucide-react";

type Priority = "High" | "Medium" | "Low";

type Task = {
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

type ProfileProgress = {
  xp: number;
  level: number;
  streak: number;
  best_streak: number;
  last_active_date: string | null;
};

const XP_REWARD_TASK_COMPLETE = 10;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function calculateSimpleCookedScore(tasks: Task[]) {
  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed).length;

  let score = 0;

  for (const task of pendingTasks) {
    const due = new Date(task.dueDate);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      score += task.priority === "High" ? 28 : task.priority === "Medium" ? 20 : 14;
    } else if (diffDays === 0) {
      score += task.priority === "High" ? 20 : task.priority === "Medium" ? 14 : 10;
    } else if (diffDays === 1) {
      score += task.priority === "High" ? 14 : task.priority === "Medium" ? 10 : 7;
    } else if (diffDays <= 3) {
      score += task.priority === "High" ? 10 : task.priority === "Medium" ? 7 : 5;
    } else {
      score += task.priority === "High" ? 6 : task.priority === "Medium" ? 4 : 2;
    }
  }

  score += Math.min(pendingTasks.length * 2, 20);

  if (tasks.length > 0) {
    const completionRate = completedTasks / tasks.length;
    if (completionRate >= 0.8) score -= 12;
    else if (completionRate >= 0.6) score -= 8;
    else if (completionRate >= 0.4) score -= 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getLevelFromXp(xp: number) {
  return Math.floor(xp / 100) + 1;
}

function getXpIntoCurrentLevel(xp: number) {
  return xp % 100;
}

function getXpNeededForNextLevel() {
  return 100;
}

async function recordActivityDayClient(userId: string) {
  const today = getTodayDate();

  const { error } = await supabase.from("user_activity_days").upsert(
    {
      user_id: userId,
      activity_date: today,
    },
    {
      onConflict: "user_id,activity_date",
    }
  );

  if (error) {
    console.error("Error recording activity day:", error.message);
  }
}

async function upsertTodayLeaderboardSnapshotClient(
  userId: string,
  tasks: Task[]
) {
  const cookedScore = calculateSimpleCookedScore(tasks);
  const pendingTasks = tasks.filter((task) => !task.completed).length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const today = getTodayDate();

  const { error } = await supabase.from("leaderboard_snapshots").upsert(
    {
      user_id: userId,
      snapshot_date: today,
      cooked_score: cookedScore,
      pending_tasks: pendingTasks,
      completed_tasks: completedTasks,
      completion_rate: completionRate,
    },
    {
      onConflict: "user_id,snapshot_date",
    }
  );

  if (error) {
    console.error("Error upserting leaderboard snapshot:", error.message);
  }
}

async function getProfileProgress(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("xp, level, streak, best_streak, last_active_date")
    .eq("id", userId)
    .single<ProfileProgress>();

  if (error) {
    console.error("Error loading profile progress:", error.message);
    return {
      xp: 0,
      level: 1,
      streak: 0,
      best_streak: 0,
      last_active_date: null,
    };
  }

  return {
    xp: data?.xp ?? 0,
    level: data?.level ?? 1,
    streak: data?.streak ?? 0,
    best_streak: data?.best_streak ?? 0,
    last_active_date: data?.last_active_date ?? null,
  };
}

async function syncDailyProfileProgress(userId: string) {
  const profile = await getProfileProgress(userId);

  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  if (profile.last_active_date === today) {
    return {
      ...profile,
      level: profile.level || getLevelFromXp(profile.xp || 0),
    };
  }

  let nextStreak = 1;

  if (profile.last_active_date === yesterday) {
    nextStreak = (profile.streak ?? 0) + 1;
  }

  const nextBestStreak = Math.max(profile.best_streak ?? 0, nextStreak);
  const nextLevel = getLevelFromXp(profile.xp ?? 0);

  const { error } = await supabase
    .from("profiles")
    .update({
      streak: nextStreak,
      best_streak: nextBestStreak,
      level: nextLevel,
      last_active_date: today,
    })
    .eq("id", userId);

  if (error) {
    console.error("Error syncing profile progress:", error.message);
  }

  return {
    ...profile,
    streak: nextStreak,
    best_streak: nextBestStreak,
    level: nextLevel,
    last_active_date: today,
  };
}

async function awardTaskCompletionXp(userId: string, task: Task) {
  const profile = await getProfileProgress(userId);

  const nextXp = (profile.xp ?? 0) + XP_REWARD_TASK_COMPLETE;
  const nextLevel = getLevelFromXp(nextXp);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      xp: nextXp,
      level: nextLevel,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("Error awarding XP:", profileError.message);
  }

  const { error: activityError } = await supabase.from("activity_log").insert({
    user_id: userId,
    action: "task_completed",
    points: XP_REWARD_TASK_COMPLETE,
    metadata: {
      taskId: task.id,
      title: task.title,
      module: task.module,
    },
  });

  if (activityError) {
    console.error("Error logging activity:", activityError.message);
  }

  if (nextXp >= 500) {
    const { error: badgeError } = await supabase.from("badges").upsert(
      {
        user_id: userId,
        badge_key: "xp_500",
      },
      {
        onConflict: "user_id,badge_key",
        ignoreDuplicates: true,
      }
    );

    if (badgeError) {
      console.error("Error unlocking xp_500 badge:", badgeError.message);
    }
  }
}

async function maybeUnlockFirstTaskBadge(userId: string, completedTasks: number) {
  if (completedTasks < 1) return;

  const { error } = await supabase.from("badges").upsert(
    {
      user_id: userId,
      badge_key: "first_task",
    },
    {
      onConflict: "user_id,badge_key",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.error("Error unlocking first_task badge:", error.message);
  }
}

async function maybeUnlockStreakBadge(userId: string, streak: number) {
  if (streak < 7) return;

  const { error } = await supabase.from("badges").upsert(
    {
      user_id: userId,
      badge_key: "streak_7",
    },
    {
      onConflict: "user_id,badge_key",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.error("Error unlocking streak_7 badge:", error.message);
  }
}

function getPriorityClasses(priority: Priority) {
  switch (priority) {
    case "High":
      return "bg-rose-500/15 text-rose-300 border border-rose-500/20";
    case "Medium":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    case "Low":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border border-slate-500/20";
  }
}

function getPriorityDot(priority: Priority) {
  switch (priority) {
    case "High":
      return "bg-rose-400";
    case "Medium":
      return "bg-amber-400";
    case "Low":
      return "bg-emerald-400";
    default:
      return "bg-slate-400";
  }
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDueLabel(dateString: string) {
  const days = getDaysUntil(dateString);

  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formatDate(dateString)}`;
}

function getCookedTextColor(score: number) {
  if (score <= 20) return "text-emerald-300";
  if (score <= 40) return "text-lime-300";
  if (score <= 60) return "text-amber-300";
  if (score <= 80) return "text-orange-300";
  return "text-rose-300";
}

function getCookedBarClass(score: number) {
  if (score <= 20) return "bg-emerald-500";
  if (score <= 40) return "bg-lime-500";
  if (score <= 60) return "bg-amber-500";
  if (score <= 80) return "bg-orange-500";
  return "bg-rose-500";
}

function getCookedZone(score: number) {
  if (score <= 20) return "Locked In";
  if (score <= 40) return "Stable";
  if (score <= 60) return "Under Pressure";
  if (score <= 80) return "Cooked";
  return "Deep Fried";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [module, setModule] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");

  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      try {
        if (mounted) setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          window.location.href = "/login";
          return;
        }

        const syncedProfile = await syncDailyProfileProgress(user.id);

        if (mounted) {
          setXp(syncedProfile.xp ?? 0);
          setLevel(syncedProfile.level ?? 1);
          setStreak(syncedProfile.streak ?? 0);
          setBestStreak(syncedProfile.best_streak ?? 0);
        }

        await maybeUnlockStreakBadge(user.id, syncedProfile.streak ?? 0);

        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading tasks:", error.message);
          if (mounted) setTasks([]);
          return;
        }

        const mappedTasks: Task[] = (data as DatabaseTask[]).map((task) => ({
          id: task.id,
          title: task.title,
          module: task.module,
          dueDate: task.due_date,
          priority: task.priority,
          completed: task.completed,
        }));

        if (mounted) {
          setTasks(mappedTasks);
          await upsertTodayLeaderboardSnapshotClient(user.id, mappedTasks);
        }
      } catch (error) {
        console.error("Unexpected error loading tasks:", error);
        if (mounted) setTasks([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTasks();

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshProfileUi(userId: string) {
    const latest = await getProfileProgress(userId);
    setXp(latest.xp ?? 0);
    setLevel(latest.level ?? 1);
    setStreak(latest.streak ?? 0);
    setBestStreak(latest.best_streak ?? 0);
  }

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!title.trim() || !module.trim() || !dueDate) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          module: module.trim(),
          due_date: dueDate,
          priority,
          completed: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error adding task:", error.message);
      return;
    }

    const newTask: Task = {
      id: data.id,
      title: data.title,
      module: data.module,
      dueDate: data.due_date,
      priority: data.priority,
      completed: data.completed,
    };

    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);

    await upsertTodayLeaderboardSnapshotClient(user.id, updatedTasks);

    setTitle("");
    setModule("");
    setDueDate("");
    setPriority("Medium");
  }

  async function toggleTask(id: string) {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const newCompletedValue = !currentTask.completed;

    const { error } = await supabase
      .from("tasks")
      .update({ completed: newCompletedValue })
      .eq("id", id);

    if (error) {
      console.error("Error updating task:", error.message);
      return;
    }

    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: newCompletedValue } : task
    );

    setTasks(updatedTasks);

    if (newCompletedValue) {
      await recordActivityDayClient(user.id);
      await awardTaskCompletionXp(user.id, currentTask);

      const completedCount = updatedTasks.filter((task) => task.completed).length;
      await maybeUnlockFirstTaskBadge(user.id, completedCount);

      const syncedProfile = await syncDailyProfileProgress(user.id);
      await maybeUnlockStreakBadge(user.id, syncedProfile.streak ?? 0);
      await refreshProfileUi(user.id);
    }

    await upsertTodayLeaderboardSnapshotClient(user.id, updatedTasks);
  }

  async function deleteTask(id: string) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.error("Error deleting task:", error.message);
      return;
    }

    const updatedTasks = tasks.filter((task) => task.id !== id);
    setTasks(updatedTasks);

    await upsertTodayLeaderboardSnapshotClient(user.id, updatedTasks);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const activeTasks = totalTasks - completedTasks;
  const highPriorityActive = tasks.filter(
    (task) => !task.completed && task.priority === "High"
  ).length;
  const dueSoon = tasks.filter((task) => {
    if (task.completed) return false;
    const days = getDaysUntil(task.dueDate);
    return days >= 0 && days <= 3;
  }).length;

  const cookedScore = useMemo(() => calculateSimpleCookedScore(tasks), [tasks]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks]);

  const todayFocus = useMemo(() => {
    return [...tasks]
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const aDays = getDaysUntil(a.dueDate);
        const bDays = getDaysUntil(b.dueDate);

        const aScore =
          (aDays < 0 ? 100 : aDays === 0 ? 85 : aDays === 1 ? 70 : aDays <= 3 ? 50 : 20) +
          (a.priority === "High" ? 30 : a.priority === "Medium" ? 18 : 8);

        const bScore =
          (bDays < 0 ? 100 : bDays === 0 ? 85 : bDays === 1 ? 70 : bDays <= 3 ? 50 : 20) +
          (b.priority === "High" ? 30 : b.priority === "Medium" ? 18 : 8);

        return bScore - aScore;
      })
      .slice(0, 3);
  }, [tasks]);

  const xpIntoLevel = getXpIntoCurrentLevel(xp);
  const xpNeededForNextLevel = getXpNeededForNextLevel();
  const levelProgress = Math.min((xpIntoLevel / xpNeededForNextLevel) * 100, 100);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#030712] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_24%)]" />

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#07111f_0%,#091427_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
                <div className="min-w-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 sm:text-sm">
                      <Sparkles className="h-4 w-4 text-blue-300" />
                      Account-synced task workspace
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      Log out
                    </button>
                  </div>

                  <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                    Your Tasks
                  </h1>

                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                    Add tasks, manage deadlines, build momentum, and keep your
                    workload under control without losing the bigger picture.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Total Tasks
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {totalTasks}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        all tracked work
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-blue-200/70">
                        Active
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {activeTasks}
                      </p>
                      <p className="mt-2 text-xs text-blue-200/70">
                        currently open
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                        Completed
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {completedTasks}
                      </p>
                      <p className="mt-2 text-xs text-emerald-200/70">
                        tasks finished
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                        Due Soon
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {dueSoon}
                      </p>
                      <p className="mt-2 text-xs text-amber-200/70">
                        within 3 days
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white/10 p-2">
                        <Sparkles className="h-5 w-5 text-blue-200" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-200">
                          XP is now live
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Every completed task gives you {XP_REWARD_TASK_COMPLETE} XP.
                          Your streak updates automatically, and badges unlock as you build momentum.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Zap className="h-4 w-4 text-blue-300" />
                    Progress Overview
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm text-orange-300">
                        <Flame className="h-4 w-4" />
                        Streak
                      </div>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {streak}
                      </p>
                      <p className="mt-2 text-xs text-orange-200/70">
                        Best: {bestStreak} days
                      </p>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm text-cyan-300">
                        <Trophy className="h-4 w-4" />
                        Level {level}
                      </div>
                      <p className="mt-3 text-3xl font-semibold text-white">{xp}</p>
                      <p className="mt-2 text-xs text-cyan-200/70">total XP</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Level Progress
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          Level {level}
                        </p>
                      </div>
                      <p className="text-sm text-slate-400">
                        {xpIntoLevel}/{xpNeededForNextLevel} XP
                      </p>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-500"
                        style={{ width: `${Math.max(6, levelProgress)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Live Cooked Score
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                          <p
                            className={`text-4xl font-semibold ${getCookedTextColor(
                              cookedScore
                            )}`}
                          >
                            {cookedScore}
                          </p>
                          <span className="pb-1 text-slate-500">/100</span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {getCookedZone(cookedScore)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${getCookedBarClass(
                          cookedScore
                        )}`}
                        style={{ width: `${Math.max(6, cookedScore)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        High Priority
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {highPriorityActive}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Focus Picks
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {todayFocus.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <form
                onSubmit={handleAddTask}
                className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-300">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Add New Task</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Create a task with a title, module, deadline, and priority.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-slate-400">Task Title</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 focus-within:border-blue-500/50">
                      <ClipboardList className="h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. Finish coursework draft"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-slate-400">Module</label>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 focus-within:border-blue-500/50">
                        <BookOpen className="h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="e.g. Business Strategy"
                          value={module}
                          onChange={(e) => setModule(e.target.value)}
                          className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-slate-400">Due Date</label>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 focus-within:border-blue-500/50">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full bg-transparent text-white outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-slate-400">Priority</label>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 focus-within:border-blue-500/50">
                        <Flag className="h-4 w-4 text-slate-500" />
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as Priority)}
                          className="w-full bg-transparent text-white outline-none"
                        >
                          <option value="High" className="bg-slate-950">
                            High priority
                          </option>
                          <option value="Medium" className="bg-slate-950">
                            Medium priority
                          </option>
                          <option value="Low" className="bg-slate-950">
                            Low priority
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 hover:shadow-lg hover:shadow-blue-500/20 md:w-auto"
                      >
                        <Plus className="h-4 w-4" />
                        Add Task
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                    <Target className="h-3.5 w-3.5" />
                    Today’s Focus
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold text-white">
                    Priority picks to move first
                  </h2>

                  <div className="mt-5 space-y-3">
                    {todayFocus.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5 text-slate-400">
                        No active tasks right now. Clean board.
                      </div>
                    ) : (
                      todayFocus.map((task, index) => (
                        <div
                          key={task.id}
                          className="rounded-2xl border border-white/10 bg-[#0b1324] p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                Focus {index + 1}
                              </p>
                              <p className="mt-2 break-words text-base font-medium text-white">
                                {task.title}
                              </p>
                              <p className="mt-2 text-sm text-slate-400">
                                {task.module}
                              </p>
                              <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
                                <Clock3 className="h-4 w-4" />
                                {getDueLabel(task.dueDate)}
                              </div>
                            </div>

                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityClasses(
                                task.priority
                              )}`}
                            >
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                  <h2 className="text-2xl font-semibold text-white">Task Summary</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    A quick read on your current workload.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Active Tasks
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {activeTasks}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Completed
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {completedTasks}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        High Priority Open
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {highPriorityActive}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Live Cooked Score
                      </p>
                      <p
                        className={`mt-2 text-xl font-semibold ${getCookedTextColor(
                          cookedScore
                        )}`}
                      >
                        {cookedScore}/100
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold text-white">All Tasks</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Active work stays at the top. Completed tasks drop below.
                  </p>
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400">
                  {activeTasks} active • {completedTasks} completed
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b1324] p-10 text-center">
                    <h3 className="text-2xl font-semibold">Loading tasks...</h3>
                    <p className="mt-3 text-slate-400">
                      Pulling your tasks from your account.
                    </p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-[#0b1324] p-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                      <ClipboardList className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-semibold">No tasks yet</h3>
                    <p className="mx-auto mt-3 max-w-md text-slate-400">
                      Add your first task above to start organising your work and
                      keeping track of deadlines.
                    </p>
                  </div>
                ) : (
                  sortedTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group rounded-3xl border p-5 transition ${
                        task.completed
                          ? "border-emerald-500/15 bg-emerald-500/[0.06]"
                          : "border-white/10 bg-[#0b1324] hover:border-white/20 hover:bg-[#0e1730]"
                      }`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => toggleTask(task.id)}
                            className="mt-1 rounded-full transition hover:scale-105"
                            aria-label={
                              task.completed
                                ? "Mark as incomplete"
                                : "Mark as complete"
                            }
                          >
                            {task.completed ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                            ) : (
                              <Circle className="h-6 w-6 text-slate-500" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${getPriorityDot(
                                  task.priority
                                )}`}
                              />
                              <h2
                                className={`break-words text-xl font-semibold transition ${
                                  task.completed
                                    ? "text-slate-500 line-through"
                                    : "text-white"
                                }`}
                              >
                                {task.title}
                              </h2>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                {task.module}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Due: {formatDate(task.dueDate)}
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-sm ${getPriorityClasses(
                                  task.priority
                                )}`}
                              >
                                {task.priority}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                                {getDueLabel(task.dueDate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-sm ${
                              task.completed
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                                : "bg-blue-500/15 text-blue-300 border border-blue-500/20"
                            }`}
                          >
                            {task.completed ? "Completed" : "Active"}
                          </span>

                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}