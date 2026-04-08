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
  Clock3,
  Filter,
  ChevronRight,
  Zap,
} from "lucide-react";

type Priority = "High" | "Medium" | "Low";
type TaskFilter = "All" | "Active" | "Completed" | "Overdue";

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

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDaysUntilDue(date: string) {
  const due = new Date(date);
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueLabel(task: Task) {
  const diffDays = getDaysUntilDue(task.dueDate);

  if (task.completed) {
    return {
      label: "Completed",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue`,
      className: "border-red-500/20 bg-red-500/10 text-red-300",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due today",
      className: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    };
  }

  if (diffDays === 1) {
    return {
      label: "Due tomorrow",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }

  if (diffDays <= 3) {
    return {
      label: `Due in ${diffDays} days`,
      className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    };
  }

  return {
    label: `Due in ${diffDays} days`,
    className: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  };
}

function getPriorityClasses(priority: Priority) {
  switch (priority) {
    case "High":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "Medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "Low":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  }
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

  const [filter, setFilter] = useState<TaskFilter>("All");

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
  const overdueTasks = tasks.filter(
    (task) => !task.completed && getDaysUntilDue(task.dueDate) < 0
  ).length;

  const cookedScore = useMemo(() => calculateSimpleCookedScore(tasks), [tasks]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case "Active":
        return sortedTasks.filter((task) => !task.completed);
      case "Completed":
        return sortedTasks.filter((task) => task.completed);
      case "Overdue":
        return sortedTasks.filter(
          (task) => !task.completed && getDaysUntilDue(task.dueDate) < 0
        );
      default:
        return sortedTasks;
    }
  }, [sortedTasks, filter]);

  const xpIntoLevel = getXpIntoCurrentLevel(xp);
  const xpNeededForNextLevel = getXpNeededForNextLevel();
  const levelProgress = Math.min((xpIntoLevel / xpNeededForNextLevel) * 100, 100);

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14),transparent_24%)]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  LockdIn task hub
                </div>

                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                  Your Tasks
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Plan deadlines, stay on top of modules, and turn your workload into
                  something actually manageable.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    {activeTasks} active
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    {completedTasks} completed
                  </div>
                  <div className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
                    {overdueTasks} overdue
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[390px]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  Log out
                </button>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
                  XP rewards live
                </div>

                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-orange-300">
                    <Flame className="h-4 w-4" />
                    <span className="text-sm font-medium">Streak</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{streak}</p>
                  <p className="mt-1 text-xs text-orange-200/70">
                    Best: {bestStreak} days
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm font-medium">Level {level}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{xp} XP</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${Math.max(6, levelProgress)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-cyan-200/70">
                    {xpIntoLevel}/{xpNeededForNextLevel} to next level
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/10 p-2.5 text-blue-300">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Total Tasks</p>
              </div>
              <p className="mt-4 text-3xl font-bold text-white">{totalTasks}</p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/10 p-2.5 text-blue-300">
                  <Target className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Active</p>
              </div>
              <p className="mt-4 text-3xl font-bold text-blue-300">{activeTasks}</p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Completed</p>
              </div>
              <p className="mt-4 text-3xl font-bold text-emerald-300">
                {completedTasks}
              </p>
            </div>

            <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-red-500/10 p-2.5 text-red-300">
                  <Clock3 className="h-5 w-5" />
                </div>
                <p className="text-sm text-red-200/80">Overdue</p>
              </div>
              <p className="mt-4 text-3xl font-bold text-white">{overdueTasks}</p>
            </div>

            <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-300">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="text-sm text-amber-200/80">Cooked score</p>
              </div>
              <p className="mt-4 text-3xl font-bold text-white">{cookedScore}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
            <div className="space-y-6">
              <form
                onSubmit={handleAddTask}
                className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Add New Task</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Create a task with a title, module, deadline, and priority.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm text-slate-400">
                      Task title
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 focus-within:border-blue-500/40">
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

                  <div>
                    <label className="mb-2 block text-sm text-slate-400">
                      Module
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 focus-within:border-blue-500/40">
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm text-slate-400">
                        Due date
                      </label>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 focus-within:border-blue-500/40">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full bg-transparent text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-400">
                        Priority
                      </label>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 focus-within:border-blue-500/40">
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
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Add task
                </button>
              </form>

              <div className="rounded-[28px] border border-blue-500/20 bg-blue-500/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/10 p-2 text-blue-200">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-200">
                      XP progression is live
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Every completed task gives you {XP_REWARD_TASK_COMPLETE} XP.
                      Streaks update automatically, and badges unlock as you build consistency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-slate-900 p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Quick tip</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      Clear overdue tasks first for the fastest stress reduction.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Knock out anything overdue or due today, then work forward in date order.
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-cyan-300" />
                      <h2 className="text-xl font-semibold text-white">Task list</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Focus your view by filtering what matters right now.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["All", "Active", "Completed", "Overdue"] as TaskFilter[]).map(
                      (option) => {
                        const active = filter === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setFilter(option)}
                            className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                              active
                                ? "border-blue-400/20 bg-blue-500/10 text-blue-300"
                                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
                    <h3 className="text-2xl font-semibold text-white">Loading tasks...</h3>
                    <p className="mt-3 text-slate-400">
                      Pulling your tasks from your account.
                    </p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80">
                      <ClipboardList className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">No tasks yet</h3>
                    <p className="mx-auto mt-3 max-w-md text-slate-400">
                      Add your first task to start organising your workload and tracking deadlines properly.
                    </p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80">
                      <Filter className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">Nothing here</h3>
                    <p className="mx-auto mt-3 max-w-md text-slate-400">
                      There are no tasks in the <span className="text-slate-200">{filter}</span> view right now.
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const dueMeta = getDueLabel(task);

                    return (
                      <div
                        key={task.id}
                        className="group rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition hover:border-white/15 hover:bg-white/[0.06]"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex items-start gap-4">
                            <button
                              type="button"
                              onClick={() => toggleTask(task.id)}
                              className="mt-1 rounded-full transition hover:scale-105"
                              aria-label={
                                task.completed ? "Mark as incomplete" : "Mark as complete"
                              }
                            >
                              {task.completed ? (
                                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                              ) : (
                                <Circle className="h-6 w-6 text-slate-500" />
                              )}
                            </button>

                            <div className="min-w-0">
                              <h2
                                className={`text-xl font-semibold transition ${
                                  task.completed
                                    ? "text-slate-500 line-through"
                                    : "text-white"
                                }`}
                              >
                                {task.title}
                              </h2>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-sm text-slate-300">
                                  {task.module}
                                </span>

                                <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-sm text-slate-300">
                                  Due: {formatDate(task.dueDate)}
                                </span>

                                <span
                                  className={`rounded-full border px-3 py-1 text-sm ${getPriorityClasses(
                                    task.priority
                                  )}`}
                                >
                                  {task.priority}
                                </span>

                                <span
                                  className={`rounded-full border px-3 py-1 text-sm ${dueMeta.className}`}
                                >
                                  {dueMeta.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded-full border px-3 py-1 text-sm ${
                                task.completed
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                  : "border-blue-500/20 bg-blue-500/10 text-blue-300"
                              }`}
                            >
                              {task.completed ? "Completed" : "Active"}
                            </span>

                            <button
                              type="button"
                              onClick={() => deleteTask(task.id)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}