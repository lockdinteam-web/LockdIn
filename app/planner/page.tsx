"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import {
  CalendarDays,
  Clock3,
  BookOpen,
  Sparkles,
  Target,
  Save,
  RefreshCw,
  CheckCircle2,
  Circle,
  Trash2,
  Wand2,
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

type StudyBlock = {
  id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  taskId: string | null;
  durationMinutes: number;
  completed: boolean;
  location: string;
};

type DatabaseStudyBlock = {
  id: string;
  user_id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  task_id: string | null;
  duration_minutes: number;
  completed: boolean;
  location: string;
  created_at?: string;
};

type PlannerPreferences = {
  availableDays: string[];
  availableTimeSlots: string[];
  sessionLength: number;
  dailySessionLimit: number;
  location: string;
};

type DatabasePlannerPreferences = {
  user_id: string;
  available_days: string[];
  available_time_slots: string[];
  session_length: number;
  daily_session_limit: number;
  location: string;
};

const DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIME_SLOT_OPTIONS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

const DEFAULT_PREFERENCES: PlannerPreferences = {
  availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  availableTimeSlots: ["10:00", "14:00", "18:00"],
  sessionLength: 60,
  dailySessionLimit: 2,
  location: "Library",
};

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysUntil(dateString: string) {
  const today = getTodayStart();
  const due = new Date(dateString);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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

function getPriorityClasses(priority: Priority) {
  switch (priority) {
    case "High":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    case "Medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "Low":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function sortDays(days: string[]) {
  return [...days].sort(
    (a, b) => DAY_OPTIONS.indexOf(a) - DAY_OPTIONS.indexOf(b)
  );
}

function sortTimes(times: string[]) {
  return [...times].sort((a, b) => a.localeCompare(b));
}

function buildTaskWeight(task: Task) {
  const daysUntil = getDaysUntil(task.dueDate);

  let urgency = 0;
  if (daysUntil < 0) urgency = 10;
  else if (daysUntil === 0) urgency = 9;
  else if (daysUntil === 1) urgency = 8;
  else if (daysUntil <= 3) urgency = 7;
  else if (daysUntil <= 7) urgency = 5;
  else urgency = 3;

  const priorityWeight =
    task.priority === "High" ? 4 : task.priority === "Medium" ? 2 : 1;

  return urgency + priorityWeight;
}

function getRecommendedBlockCount(task: Task) {
  const daysUntil = getDaysUntil(task.dueDate);

  if (daysUntil < 0) return 3;
  if (daysUntil <= 1) return 3;
  if (daysUntil <= 3) return 2;
  if (daysUntil <= 7) return task.priority === "High" ? 2 : 1;
  return task.priority === "High" ? 2 : 1;
}

function generatePlanFromTasks(
  tasks: Task[],
  preferences: PlannerPreferences
): Omit<StudyBlock, "id">[] {
  const activeTasks = tasks.filter((task) => !task.completed);

  if (activeTasks.length === 0) return [];
  if (preferences.availableDays.length === 0) return [];
  if (preferences.availableTimeSlots.length === 0) return [];
  if (preferences.dailySessionLimit <= 0) return [];

  const orderedDays = sortDays(preferences.availableDays);
  const orderedTimes = sortTimes(preferences.availableTimeSlots);

  const limitedTimes = orderedTimes.slice(
    0,
    Math.min(preferences.dailySessionLimit, orderedTimes.length)
  );

  const availableSlots = orderedDays.flatMap((day) =>
    limitedTimes.map((time) => ({ day, time }))
  );

  if (availableSlots.length === 0) return [];

  const rankedTasks = [...activeTasks].sort((a, b) => {
    return buildTaskWeight(b) - buildTaskWeight(a);
  });

  const expandedTasks: Task[] = [];

  for (const task of rankedTasks) {
    const repeats = getRecommendedBlockCount(task);
    for (let i = 0; i < repeats; i++) {
      expandedTasks.push(task);
    }
  }

  if (expandedTasks.length === 0) return [];

  const assignedTasks: Task[] = [];
  let pointer = 0;

  while (assignedTasks.length < availableSlots.length) {
    assignedTasks.push(expandedTasks[pointer % expandedTasks.length]);
    pointer += 1;

    if (pointer > availableSlots.length * 3) break;
  }

  return availableSlots.map((slot, index) => {
    const task = assignedTasks[index];
    return {
      day: slot.day,
      time: slot.time,
      subject: task.module,
      focus: task.title,
      taskId: task.id,
      durationMinutes: preferences.sessionLength,
      completed: false,
      location: preferences.location || "Library",
    };
  });
}

function groupBlocksByDay(blocks: StudyBlock[]) {
  const grouped = DAY_OPTIONS.map((day) => ({
    day,
    blocks: blocks
      .filter((block) => block.day === day)
      .sort((a, b) => a.time.localeCompare(b.time)),
  }));

  return grouped.filter((group) => group.blocks.length > 0);
}

export default function PlannerPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [plan, setPlan] = useState<StudyBlock[]>([]);
  const [preferences, setPreferences] =
    useState<PlannerPreferences>(DEFAULT_PREFERENCES);
  const [plannerMessage, setPlannerMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
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

        const [
          { data: taskData, error: taskError },
          { data: prefData, error: prefError },
          { data: planData, error: planError },
        ] = await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("planner_preferences")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("study_plan_blocks")
            .select("*")
            .eq("user_id", user.id)
            .order("day", { ascending: true })
            .order("time", { ascending: true }),
        ]);

        if (taskError) {
          console.error("Error loading tasks:", taskError.message);
        }

        if (prefError) {
          console.error("Error loading planner preferences:", prefError.message);
        }

        if (planError) {
          console.error("Error loading study plan:", planError.message);
        }

        const mappedTasks: Task[] = ((taskData ?? []) as DatabaseTask[]).map(
          (task) => ({
            id: task.id,
            title: task.title,
            module: task.module,
            dueDate: task.due_date,
            priority: task.priority,
            completed: task.completed,
          })
        );

        const mappedPrefs: PlannerPreferences = prefData
          ? {
              availableDays:
                prefData.available_days ?? DEFAULT_PREFERENCES.availableDays,
              availableTimeSlots:
                prefData.available_time_slots ??
                DEFAULT_PREFERENCES.availableTimeSlots,
              sessionLength:
                prefData.session_length ?? DEFAULT_PREFERENCES.sessionLength,
              dailySessionLimit:
                prefData.daily_session_limit ??
                DEFAULT_PREFERENCES.dailySessionLimit,
              location: prefData.location ?? DEFAULT_PREFERENCES.location,
            }
          : DEFAULT_PREFERENCES;

        const mappedPlan: StudyBlock[] = (
          (planData ?? []) as DatabaseStudyBlock[]
        ).map((block) => ({
          id: block.id,
          day: block.day,
          time: block.time,
          subject: block.subject,
          focus: block.focus,
          taskId: block.task_id,
          durationMinutes: block.duration_minutes,
          completed: block.completed,
          location: block.location,
        }));

        if (!mounted) return;

        setTasks(mappedTasks);
        setPreferences(mappedPrefs);
        setPlan(mappedPlan);
      } catch (error) {
        console.error("Unexpected error loading planner page:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  async function savePreferences(nextPrefs: PlannerPreferences) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return false;
    }

    const { error } = await supabase.from("planner_preferences").upsert(
      {
        user_id: user.id,
        available_days: nextPrefs.availableDays,
        available_time_slots: nextPrefs.availableTimeSlots,
        session_length: nextPrefs.sessionLength,
        daily_session_limit: nextPrefs.dailySessionLimit,
        location: nextPrefs.location,
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("Error saving planner preferences:", error.message);
      return false;
    }

    return true;
  }

  async function handleSavePreferences() {
    const saved = await savePreferences(preferences);
    setPlannerMessage(
      saved
        ? "Planner preferences saved."
        : "Could not save planner preferences."
    );
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    setPlannerMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const saved = await savePreferences(preferences);
      if (!saved) {
        setPlannerMessage("Could not save planner preferences.");
        return;
      }

      const generated = generatePlanFromTasks(tasks, preferences);

      if (generated.length === 0) {
        setPlan([]);
        setPlannerMessage(
          "No plan could be generated. Make sure you have unfinished tasks and at least one study day and time selected."
        );
        return;
      }

      const localPlan: StudyBlock[] = generated.map((block, index) => ({
        id: `temp-${index}-${block.day}-${block.time}`,
        day: block.day,
        time: block.time,
        subject: block.subject,
        focus: block.focus,
        taskId: block.taskId,
        durationMinutes: block.durationMinutes,
        completed: false,
        location: block.location,
      }));

      setPlan(localPlan);
      setPlannerMessage(
        `Generated ${localPlan.length} study block${
          localPlan.length === 1 ? "" : "s"
        }.`
      );

      const { error: deleteError } = await supabase
        .from("study_plan_blocks")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error clearing old study plan:", deleteError.message);
        setPlannerMessage(
          "Plan was generated, but old saved blocks could not be cleared."
        );
        return;
      }

      const payload = generated.map((block) => ({
        user_id: user.id,
        day: block.day,
        time: block.time,
        subject: block.subject,
        focus: block.focus,
        task_id: block.taskId,
        duration_minutes: block.durationMinutes,
        completed: block.completed,
        location: block.location,
      }));

      const { error: insertError } = await supabase
        .from("study_plan_blocks")
        .insert(payload);

      if (insertError) {
        console.error("Error saving generated study plan:", insertError.message);
        setPlannerMessage(
          "Plan generated in the UI, but saving to your account failed. Check your table setup or RLS."
        );
        return;
      }

      const { data: refreshedData, error: refreshError } = await supabase
        .from("study_plan_blocks")
        .select("*")
        .eq("user_id", user.id)
        .order("day", { ascending: true })
        .order("time", { ascending: true });

      if (refreshError) {
        console.error("Error reloading saved study plan:", refreshError.message);
        setPlannerMessage(
          "Plan generated and saved, but it could not be reloaded from the database."
        );
        return;
      }

      const mappedPlan: StudyBlock[] = (
        (refreshedData ?? []) as DatabaseStudyBlock[]
      ).map((block) => ({
        id: block.id,
        day: block.day,
        time: block.time,
        subject: block.subject,
        focus: block.focus,
        taskId: block.task_id,
        durationMinutes: block.duration_minutes,
        completed: block.completed,
        location: block.location,
      }));

      setPlan(mappedPlan);
      setPlannerMessage(
        `Plan generated and saved successfully with ${mappedPlan.length} block${
          mappedPlan.length === 1 ? "" : "s"
        }.`
      );
    } catch (error) {
      console.error("Unexpected generate plan error:", error);
      setPlannerMessage("Something went wrong while generating your plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleBlockComplete(id: string) {
    const current = plan.find((block) => block.id === id);
    if (!current) return;

    const { error } = await supabase
      .from("study_plan_blocks")
      .update({ completed: !current.completed })
      .eq("id", id);

    if (error) {
      console.error("Error updating study block:", error.message);
      return;
    }

    setPlan((prev) =>
      prev.map((block) =>
        block.id === id ? { ...block, completed: !block.completed } : block
      )
    );
  }

  async function deleteBlock(id: string) {
    const { error } = await supabase
      .from("study_plan_blocks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting study block:", error.message);
      return;
    }

    setPlan((prev) => prev.filter((block) => block.id !== id));
  }

  function toggleAvailableDay(day: string) {
    setPreferences((prev) => {
      const exists = prev.availableDays.includes(day);
      const nextDays = exists
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];

      return {
        ...prev,
        availableDays: sortDays(nextDays),
      };
    });
  }

  function toggleAvailableTime(time: string) {
    setPreferences((prev) => {
      const exists = prev.availableTimeSlots.includes(time);
      const nextTimes = exists
        ? prev.availableTimeSlots.filter((t) => t !== time)
        : [...prev.availableTimeSlots, time];

      return {
        ...prev,
        availableTimeSlots: sortTimes(nextTimes),
      };
    });
  }

  const activeTasks = tasks.filter((task) => !task.completed);
  const groupedPlan = useMemo(() => groupBlocksByDay(plan), [plan]);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#030712] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_24%)]" />

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#07111f_0%,#091427_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 sm:text-sm">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    Account-synced study planner
                  </div>

                  <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                    Study Planner
                  </h1>

                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                    Set your availability, generate a study plan from your live
                    tasks, and save it directly to your account.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Active Tasks
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {activeTasks.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-blue-200/70">
                        Plan Blocks
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {plan.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                        Completed Blocks
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {plan.filter((block) => block.completed).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Target className="h-4 w-4 text-blue-300" />
                    Planner Summary
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Available Days
                      </p>
                      <p className="mt-2 text-white">
                        {preferences.availableDays.length > 0
                          ? preferences.availableDays.join(", ")
                          : "None selected"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Time Slots
                      </p>
                      <p className="mt-2 text-white">
                        {preferences.availableTimeSlots.length > 0
                          ? preferences.availableTimeSlots.join(", ")
                          : "None selected"}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Session Length
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {preferences.sessionLength} mins
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Daily Limit
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {preferences.dailySessionLimit} blocks
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                      <p className="text-sm font-medium text-blue-200">
                        How generation works
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        The planner prioritises unfinished tasks by urgency and
                        priority, then fills your selected study slots and saves
                        them to your account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-300">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Planner Preferences</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Choose when you can study, then generate a saved plan from
                      your tasks.
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-6">
                  <div>
                    <label className="text-sm text-slate-400">
                      Available Days
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DAY_OPTIONS.map((day) => {
                        const active = preferences.availableDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleAvailableDay(day)}
                            className={`rounded-2xl border px-4 py-2 text-sm transition ${
                              active
                                ? "border-blue-500/30 bg-blue-500/15 text-blue-200"
                                : "border-white/10 bg-[#0b1324] text-slate-300 hover:border-white/20"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">
                      Available Time Slots
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {TIME_SLOT_OPTIONS.map((time) => {
                        const active = preferences.availableTimeSlots.includes(
                          time
                        );
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => toggleAvailableTime(time)}
                            className={`rounded-2xl border px-4 py-2 text-sm transition ${
                              active
                                ? "border-blue-500/30 bg-blue-500/15 text-blue-200"
                                : "border-white/10 bg-[#0b1324] text-slate-300 hover:border-white/20"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-slate-400">
                        Session Length
                      </label>
                      <select
                        value={preferences.sessionLength}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            sessionLength: Number(e.target.value),
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 text-white outline-none"
                      >
                        <option value={30}>30 mins</option>
                        <option value={45}>45 mins</option>
                        <option value={60}>60 mins</option>
                        <option value={90}>90 mins</option>
                        <option value={120}>120 mins</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-slate-400">
                        Daily Session Limit
                      </label>
                      <select
                        value={preferences.dailySessionLimit}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            dailySessionLimit: Number(e.target.value),
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 text-white outline-none"
                      >
                        <option value={1}>1 block</option>
                        <option value={2}>2 blocks</option>
                        <option value={3}>3 blocks</option>
                        <option value={4}>4 blocks</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-slate-400">
                        Study Location
                      </label>
                      <input
                        type="text"
                        value={preferences.location}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        placeholder="e.g. Library"
                        className="rounded-2xl border border-white/10 bg-[#0b1324] px-4 py-3 text-white outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSavePreferences}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-white transition hover:border-white/20"
                    >
                      <Save className="h-4 w-4" />
                      Save Preferences
                    </button>

                    <button
                      type="button"
                      onClick={handleGeneratePlan}
                      disabled={generating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Wand2 className="h-4 w-4" />
                      {generating ? "Generating..." : "Generate Plan"}
                    </button>
                  </div>

                  {plannerMessage ? (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                      {plannerMessage}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                    <BookOpen className="h-3.5 w-3.5" />
                    Active Task Inputs
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold text-white">
                    Tasks feeding your planner
                  </h2>

                  <div className="mt-5 space-y-3">
                    {activeTasks.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5 text-slate-400">
                        No active tasks found. Add tasks first, then generate a
                        plan.
                      </div>
                    ) : (
                      activeTasks
                        .sort((a, b) => buildTaskWeight(b) - buildTaskWeight(a))
                        .slice(0, 6)
                        .map((task) => (
                          <div
                            key={task.id}
                            className="rounded-2xl border border-white/10 bg-[#0b1324] p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="break-words text-base font-medium text-white">
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
                                className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getPriorityClasses(
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
                  <h2 className="text-2xl font-semibold text-white">Plan Tips</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Better inputs make the generated plan feel smarter.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4 text-sm text-slate-300">
                      Pick realistic study days instead of every single day.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4 text-sm text-slate-300">
                      Use 2–3 time slots you actually stick to most weeks.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4 text-sm text-slate-300">
                      High-priority and urgent tasks are assigned first.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4 text-sm text-slate-300">
                      Regenerate any time after adding or finishing tasks.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold text-white">
                    Your Study Plan
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Generated blocks are saved to your account and stay after
                    refresh.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
              </div>

              <div className="mt-8 space-y-6">
                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b1324] p-10 text-center">
                    <h3 className="text-2xl font-semibold">Loading planner...</h3>
                    <p className="mt-3 text-slate-400">
                      Pulling your saved preferences and study blocks.
                    </p>
                  </div>
                ) : plan.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-[#0b1324] p-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                      <CalendarDays className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-semibold">
                      No plan generated yet
                    </h3>
                    <p className="mx-auto mt-3 max-w-md text-slate-400">
                      Set your availability above and generate a plan from your
                      unfinished tasks.
                    </p>
                  </div>
                ) : (
                  groupedPlan.map((group) => (
                    <div key={group.day}>
                      <h3 className="mb-4 text-xl font-semibold text-white">
                        {group.day}
                      </h3>

                      <div className="space-y-4">
                        {group.blocks.map((block) => (
                          <div
                            key={block.id}
                            className={`rounded-3xl border p-5 transition ${
                              block.completed
                                ? "border-emerald-500/15 bg-emerald-500/[0.06]"
                                : "border-white/10 bg-[#0b1324] hover:border-white/20 hover:bg-[#0e1730]"
                            }`}
                          >
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <div className="flex items-start gap-4">
                                <button
                                  type="button"
                                  onClick={() => toggleBlockComplete(block.id)}
                                  className="mt-1 rounded-full transition hover:scale-105"
                                  aria-label={
                                    block.completed
                                      ? "Mark block as incomplete"
                                      : "Mark block as complete"
                                  }
                                >
                                  {block.completed ? (
                                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                                  ) : (
                                    <Circle className="h-6 w-6 text-slate-500" />
                                  )}
                                </button>

                                <div className="min-w-0">
                                  <h4
                                    className={`break-words text-xl font-semibold ${
                                      block.completed
                                        ? "text-slate-500 line-through"
                                        : "text-white"
                                    }`}
                                  >
                                    {block.focus}
                                  </h4>

                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                      {block.subject}
                                    </span>

                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                      {block.day} • {block.time}
                                    </span>

                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                      {block.durationMinutes} mins
                                    </span>

                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                      {block.location}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <span
                                  className={`rounded-full px-3 py-1 text-sm ${
                                    block.completed
                                      ? "border border-emerald-500/20 bg-emerald-500/15 text-emerald-300"
                                      : "border border-blue-500/20 bg-blue-500/15 text-blue-300"
                                  }`}
                                >
                                  {block.completed ? "Completed" : "Planned"}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => deleteBlock(block.id)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
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