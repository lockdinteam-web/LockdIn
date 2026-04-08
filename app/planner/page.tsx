"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useTasks } from "@/components/TasksProvider";
import { useStudyPlan } from "@/components/StudyPlanProvider";
import { supabase } from "@/lib/supabase";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Sparkles,
  RefreshCcw,
  CheckCircle2,
  Target,
  BookOpen,
  Brain,
  SlidersHorizontal,
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

type StudyBlock = {
  id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  task_id: string | null;
  duration_minutes: number;
  completed: boolean;
  location: string;
};

type PlannerPreferences = {
  availableDays: string[];
  availableTimeSlots: string[];
  preferredLocation: string;
};

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const timeSlots = [
  "9:00 AM – 10:30 AM",
  "11:00 AM – 12:30 PM",
  "2:00 PM – 3:30 PM",
  "4:00 PM – 5:30 PM",
  "7:00 PM – 8:30 PM",
  "8:45 PM – 10:15 PM",
];

const defaultPreferences: PlannerPreferences = {
  availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  availableTimeSlots: [
    "11:00 AM – 12:30 PM",
    "2:00 PM – 3:30 PM",
    "7:00 PM – 8:30 PM",
  ],
  preferredLocation: "Library",
};

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyLabel(daysUntil: number) {
  if (daysUntil < 0) return "Overdue";
  if (daysUntil === 0) return "Due today";
  if (daysUntil === 1) return "Due tomorrow";
  return `Due in ${daysUntil} days`;
}

function getPriorityClass(priority: Priority) {
  if (priority === "High") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20";
  }
  if (priority === "Medium") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20";
  }
  return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20";
}

function getPriorityDot(priority: Priority) {
  if (priority === "High") return "bg-rose-400";
  if (priority === "Medium") return "bg-amber-400";
  return "bg-emerald-400";
}

function getSessionCardClass(completed: boolean) {
  return completed
    ? "border-emerald-500/25 bg-emerald-500/10"
    : "border-white/10 bg-[#0b1324] hover:border-blue-400/40 hover:bg-[#0d1830]";
}

function buildStudyPlan(
  tasks: Task[],
  preferences: PlannerPreferences
): Omit<StudyBlock, "id" | "completed">[] {
  const incomplete = tasks.filter((task) => !task.completed);

  const priorityScore: Record<Priority, number> = {
    High: 0,
    Medium: 1,
    Low: 2,
  };

  const sortedTasks = [...incomplete].sort((a, b) => {
    if (priorityScore[a.priority] !== priorityScore[b.priority]) {
      return priorityScore[a.priority] - priorityScore[b.priority];
    }

    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const usableDays = preferences.availableDays;
  const usableSlots = preferences.availableTimeSlots;

  if (usableDays.length === 0 || usableSlots.length === 0) {
    return [];
  }

  const availableCombinations = usableDays.flatMap((day) =>
    usableSlots.map((time) => ({ day, time }))
  );

  return sortedTasks
    .slice(0, availableCombinations.length)
    .map((task, index) => {
      const slot = availableCombinations[index];

      return {
        day: slot.day,
        time: slot.time,
        subject: task.module,
        focus: task.title,
        task_id: task.id,
        duration_minutes: 90,
        location: preferences.preferredLocation || "Study space",
      };
    });
}

export default function PlannerPage() {
  const { tasks: providerTasks, loading: tasksLoading } = useTasks();
  const {
    studyBlocks: providerStudyBlocks,
    loading: studyPlanLoading,
    refreshStudyBlocks,
  } = useStudyPlan();

  const [preferences, setPreferences] =
    useState<PlannerPreferences>(defaultPreferences);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function initialisePlanner() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("planner_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setPreferences({
          availableDays: Array.isArray(data.available_days)
            ? data.available_days
            : defaultPreferences.availableDays,
          availableTimeSlots: Array.isArray(data.available_time_slots)
            ? data.available_time_slots
            : defaultPreferences.availableTimeSlots,
          preferredLocation:
            data.preferred_location || defaultPreferences.preferredLocation,
        });
      }

      setPreferencesLoading(false);
      setAuthChecked(true);
    }

    initialisePlanner();
  }, []);

  const tasks = useMemo<Task[]>(() => {
    return (providerTasks as any[]).map((task) => ({
      id: task.id,
      title: task.title,
      module: task.module,
      dueDate: task.dueDate ?? task.due_date ?? "",
      priority: task.priority,
      completed: task.completed,
    }));
  }, [providerTasks]);

  const studyPlan = useMemo<StudyBlock[]>(() => {
    return (providerStudyBlocks as any[]).map((session) => ({
      id: session.id,
      day: session.day,
      time: session.time,
      subject: session.subject,
      focus: session.focus,
      task_id: session.task_id ?? null,
      duration_minutes: session.duration_minutes ?? 90,
      completed: session.completed,
      location: session.location ?? "Study space",
    }));
  }, [providerStudyBlocks]);

  const loading =
    !authChecked || tasksLoading || studyPlanLoading || preferencesLoading;

  const incompleteTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks]
  );

  const planningStats = useMemo(() => {
    const completedSessions = studyPlan.filter((session) => session.completed).length;
    const pendingSessions = studyPlan.filter((session) => !session.completed).length;

    const totalHours =
      Math.round(
        (studyPlan.reduce(
          (sum, session) => sum + (session.duration_minutes ?? 90),
          0
        ) /
          60) *
          10
      ) / 10;

    const completionRate =
      studyPlan.length > 0
        ? Math.round((completedSessions / studyPlan.length) * 100)
        : 0;

    const nextTask = [...incompleteTasks].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )[0];

    return {
      completedSessions,
      pendingSessions,
      totalHours,
      nextTask,
      completionRate,
    };
  }, [studyPlan, incompleteTasks]);

  const groupedPlan = useMemo(() => {
    return weekdays
      .map((day) => ({
        day,
        sessions: studyPlan.filter((session) => session.day === day),
      }))
      .filter((group) => group.sessions.length > 0);
  }, [studyPlan]);

  const availableSlotsCount =
    preferences.availableDays.length * preferences.availableTimeSlots.length;

  async function savePreferences(nextPreferences: PlannerPreferences) {
    setPreferences(nextPreferences);
    setSavingPreferences(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("planner_preferences").upsert(
      {
        user_id: user.id,
        available_days: nextPreferences.availableDays,
        available_time_slots: nextPreferences.availableTimeSlots,
        preferred_location: nextPreferences.preferredLocation,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Error saving planner preferences:", error.message);
    }

    setSavingPreferences(false);
  }

  async function regeneratePlan() {
    const generatedPlan = buildStudyPlan(tasks, preferences);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { error: deleteError } = await supabase
      .from("study_blocks")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error clearing old study plan:", deleteError.message);
      return;
    }

    if (generatedPlan.length > 0) {
      const { error: insertError } = await supabase.from("study_blocks").insert(
        generatedPlan.map((session) => ({
          user_id: user.id,
          day: session.day,
          time: session.time,
          subject: session.subject,
          focus: session.focus,
          task_id: session.task_id,
          duration_minutes: session.duration_minutes,
          completed: false,
          location: session.location,
        }))
      );

      if (insertError) {
        console.error("Error generating study plan:", insertError.message);
        return;
      }
    }

    await refreshStudyBlocks();
  }

  async function toggleSessionComplete(id: string, completed: boolean) {
    const { error } = await supabase
      .from("study_blocks")
      .update({ completed: !completed })
      .eq("id", id);

    if (error) {
      console.error("Error updating study session:", error.message);
      return;
    }

    await refreshStudyBlocks();
  }

  async function toggleAvailableDay(day: string) {
    const nextPreferences: PlannerPreferences = {
      ...preferences,
      availableDays: preferences.availableDays.includes(day)
        ? preferences.availableDays.filter((item) => item !== day)
        : [...preferences.availableDays, day],
    };

    await savePreferences(nextPreferences);
  }

  async function toggleAvailableTimeSlot(slot: string) {
    const nextPreferences: PlannerPreferences = {
      ...preferences,
      availableTimeSlots: preferences.availableTimeSlots.includes(slot)
        ? preferences.availableTimeSlots.filter((item) => item !== slot)
        : [...preferences.availableTimeSlots, slot],
    };

    await savePreferences(nextPreferences);
  }

  function updatePreferredLocation(value: string) {
    const nextPreferences: PlannerPreferences = {
      ...preferences,
      preferredLocation: value,
    };

    setPreferences(nextPreferences);
  }

  async function savePreferredLocationOnBlur() {
    await savePreferences(preferences);
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#030712] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.06),transparent_24%)]" />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#07111f_0%,#091427_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 sm:text-sm">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    Account-synced smart planner
                  </div>

                  <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                    Smarter weekly study planning
                  </h1>

                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                    Generate a study plan from your real tasks, ordered by urgency
                    and priority, then fitted into the times and places you
                    actually want to study.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      onClick={regeneratePlan}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Regenerate Plan
                    </button>

                    <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-300">
                      {savingPreferences ? "Saving preferences..." : "Preferences saved to your account"}
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">
                        Planned Hours
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {loading ? "..." : planningStats.totalHours}
                      </p>
                      <p className="mt-2 text-xs text-cyan-200/70">
                        total this cycle
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                        Completed
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {loading ? "..." : planningStats.completedSessions}
                      </p>
                      <p className="mt-2 text-xs text-emerald-200/70">
                        sessions done
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                        Pending
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {loading ? "..." : planningStats.pendingSessions}
                      </p>
                      <p className="mt-2 text-xs text-amber-200/70">
                        sessions left
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Completion
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {loading ? "..." : `${planningStats.completionRate}%`}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        plan progress
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Brain className="h-4 w-4 text-blue-300" />
                    Weekly Overview
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold text-white">
                    {loading
                      ? "Loading your planner..."
                      : planningStats.nextTask
                      ? "Your next most urgent task is already being prioritised"
                      : "You’re ready to build your next study cycle"}
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {loading
                      ? "Syncing tasks and study sessions from your account."
                      : planningStats.nextTask
                      ? `The planner is weighting urgency and priority first, then fitting sessions around your available windows for ${planningStats.nextTask.module}.`
                      : "Once you add tasks and availability, LockdIn will generate a balanced weekly study plan automatically."}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Active Tasks
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {loading ? "..." : incompleteTasks.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Available Slots
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {availableSlotsCount}
                      </p>
                    </div>
                  </div>

                  {planningStats.nextTask ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Most urgent task
                      </p>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-white">
                            {planningStats.nextTask.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {planningStats.nextTask.module}
                          </p>
                          <p className="mt-3 text-sm text-slate-500">
                            {getUrgencyLabel(
                              getDaysUntil(planningStats.nextTask.dueDate)
                            )}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(
                            planningStats.nextTask.priority
                          )}`}
                        >
                          {planningStats.nextTask.priority}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-300">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Availability & Preferences</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Choose when you are realistically free, then set where you do
                      your best work.
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-8">
                  <div>
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      Available Days
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {weekdays.map((day) => {
                        const selected = preferences.availableDays.includes(day);

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleAvailableDay(day)}
                            className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                              selected
                                ? "bg-blue-500 text-white shadow-[0_8px_30px_rgba(59,130,246,0.25)]"
                                : "border border-white/10 bg-[#0b1324] text-slate-300 hover:border-white/20 hover:bg-[#101a30]"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      Available Time Slots
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {timeSlots.map((slot) => {
                        const selected = preferences.availableTimeSlots.includes(slot);

                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => toggleAvailableTimeSlot(slot)}
                            className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                              selected
                                ? "bg-blue-500 text-white shadow-[0_8px_30px_rgba(59,130,246,0.25)]"
                                : "border border-white/10 bg-[#0b1324] text-slate-300 hover:border-white/20 hover:bg-[#101a30]"
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      Preferred Study Location
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <input
                        type="text"
                        value={preferences.preferredLocation}
                        onChange={(e) => updatePreferredLocation(e.target.value)}
                        onBlur={savePreferredLocationOnBlur}
                        placeholder="e.g. Library, Home desk, Campus café"
                        className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                      />
                    </div>

                    <p className="mt-3 text-sm text-slate-500">
                      This location will appear on each generated session.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                    <Target className="h-3.5 w-3.5" />
                    Planning Insight
                  </div>

                  <h3 className="mt-4 text-2xl font-semibold text-white">
                    {loading
                      ? "Loading your planner..."
                      : planningStats.nextTask
                      ? "Your planner is focused on what matters next"
                      : "No current study pressure detected"}
                  </h3>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {loading
                      ? "Loading tasks, blocks, and account preferences."
                      : planningStats.nextTask
                      ? `Your next key piece of work is ${planningStats.nextTask.title}. LockdIn prioritises incomplete tasks by urgency first, then places them into your selected days and time slots.`
                      : "Add more tasks or regenerate your plan once your week changes."}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Planned Sessions
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {loading ? "..." : studyPlan.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Pending Sessions
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {loading ? "..." : planningStats.pendingSessions}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                  <h3 className="text-2xl font-semibold text-white">How this works</h3>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-sm font-medium text-white">
                        1. Incomplete tasks are ranked first
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        High priority and earlier deadlines rise to the top of your
                        generated plan.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-sm font-medium text-white">
                        2. Sessions are fitted into your real availability
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        Your selected days and time slots determine how many study
                        blocks can be created.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                      <p className="text-sm font-medium text-white">
                        3. Regenerate when your week changes
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        Add urgent tasks, change availability, or switch location,
                        then regenerate for a fresh plan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {loading ? (
              <section className="rounded-2xl border border-white/10 bg-[#08101f] p-6 text-slate-400">
                Loading your planner...
              </section>
            ) : studyPlan.length === 0 ? (
              <section className="rounded-[28px] border border-white/10 bg-[#08101f] p-6 sm:p-8">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold text-white">
                    No study plan yet
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    Add tasks and set at least one available day and one time slot,
                    then regenerate your study plan.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={regeneratePlan}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Generate Plan
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold text-white">
                      This Week’s Study Plan
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Click any session to mark it complete.
                    </p>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400">
                    {planningStats.completedSessions} completed •{" "}
                    {planningStats.pendingSessions} pending
                  </div>
                </div>

                <div className="mt-8 space-y-8">
                  {groupedPlan.map((group) => (
                    <div key={group.day}>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white">
                            {group.day}
                          </div>
                          <p className="text-sm text-slate-500">
                            {group.sessions.length} session
                            {group.sessions.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {group.sessions.map((session) => (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() =>
                              toggleSessionComplete(session.id, session.completed)
                            }
                            className={`rounded-2xl border p-5 text-left transition ${getSessionCardClass(
                              session.completed
                            )}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${
                                      session.completed
                                        ? "bg-emerald-400"
                                        : "bg-blue-400"
                                    }`}
                                  />
                                  <p className="text-sm text-slate-400">
                                    {session.time}
                                  </p>
                                </div>

                                <h3 className="mt-3 break-words text-xl font-semibold text-white">
                                  {session.subject}
                                </h3>
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  session.completed
                                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20"
                                    : "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20"
                                }`}
                              >
                                {session.completed ? "Completed" : "Planned"}
                              </span>
                            </div>

                            <p className="mt-4 text-sm leading-7 text-slate-300">
                              {session.focus}
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                <Clock3 className="h-3.5 w-3.5" />
                                {session.duration_minutes} mins
                              </span>
                              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                <MapPin className="h-3.5 w-3.5" />
                                {session.location}
                              </span>
                            </div>

                            {session.task_id ? (
                              <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                  Linked Task
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-slate-400" />
                                  <p className="text-sm text-slate-300">
                                    This block is tied to one of your real tasks.
                                  </p>
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                              <CheckCircle2 className="h-4 w-4" />
                              Tap to mark {session.completed ? "incomplete" : "complete"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                <h3 className="text-2xl font-semibold text-white">Task Pressure</h3>
                <p className="mt-2 text-sm text-slate-400">
                  What the planner is currently working around.
                </p>

                <div className="mt-5 space-y-3">
                  {incompleteTasks.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5 text-slate-400">
                      No active tasks right now.
                    </div>
                  ) : (
                    [...incompleteTasks]
                      .sort(
                        (a, b) =>
                          new Date(a.dueDate).getTime() -
                          new Date(b.dueDate).getTime()
                      )
                      .slice(0, 5)
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
                              <p className="mt-2 text-sm text-slate-500">
                                {getUrgencyLabel(getDaysUntil(task.dueDate))}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${getPriorityDot(
                                  task.priority
                                )}`}
                              />
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(
                                  task.priority
                                )}`}
                              >
                                {task.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[#08101f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-7">
                <h3 className="text-2xl font-semibold text-white">Planner Summary</h3>
                <p className="mt-2 text-sm text-slate-400">
                  A quick read on your current study setup.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Selected Days
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {preferences.availableDays.length}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {preferences.availableDays.join(", ") || "None selected"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Time Slots
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {preferences.availableTimeSlots.length}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {preferences.availableTimeSlots.length > 0
                        ? "Windows available for scheduling"
                        : "No slots selected"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Preferred Location
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {preferences.preferredLocation || "Not set"}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Added to generated blocks
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Planning Capacity
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {availableSlotsCount}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      max possible session slots
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}