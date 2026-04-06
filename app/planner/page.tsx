"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useTasks } from "@/components/TasksProvider";
import { useStudyPlan } from "@/components/StudyPlanProvider";
import { supabase } from "@/lib/supabase";

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
  if (priority === "High") return "bg-rose-500/15 text-rose-300";
  if (priority === "Medium") return "bg-amber-500/15 text-amber-300";
  return "bg-emerald-500/15 text-emerald-300";
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

  const loading = !authChecked || tasksLoading || studyPlanLoading || preferencesLoading;

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

    const nextTask = [...incompleteTasks].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )[0];

    return {
      completedSessions,
      pendingSessions,
      totalHours,
      nextTask,
    };
  }, [studyPlan, incompleteTasks]);

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

  async function updatePreferredLocation(value: string) {
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
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#08122b_0%,#061021_100%)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Planner
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              Smarter weekly study planning
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Your study plan is generated from real tasks, ordered by urgency and
              priority, and matched to when and where you actually want to study.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={regeneratePlan}
                className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
              >
                Regenerate Plan
              </button>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-300">
                {loading ? "Loading..." : planningStats.totalHours} planned study hour
                {loading || planningStats.totalHours === 1 ? "" : "s"}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-300">
                {savingPreferences ? "Saving preferences..." : "Account-synced planner"}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold">Availability & Study Preferences</h2>
              <p className="text-slate-400">
                Tell LockdIn when you are free and where you prefer to study.
              </p>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-3">
              <div>
                <p className="mb-4 text-sm font-medium text-slate-300">Available Days</p>
                <div className="flex flex-wrap gap-3">
                  {weekdays.map((day) => {
                    const selected = preferences.availableDays.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleAvailableDay(day)}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                          selected
                            ? "bg-blue-500 text-white"
                            : "border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-4 text-sm font-medium text-slate-300">Available Time Slots</p>
                <div className="flex flex-col gap-3">
                  {timeSlots.map((slot) => {
                    const selected = preferences.availableTimeSlots.includes(slot);

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleAvailableTimeSlot(slot)}
                        className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                          selected
                            ? "bg-blue-500 text-white"
                            : "border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-4 text-sm font-medium text-slate-300">Preferred Study Location</p>
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
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
                  This location will be added to each generated study session.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Planned Sessions</p>
              <p className="mt-3 text-4xl font-bold">
                {loading ? "..." : studyPlan.length}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Completed Sessions</p>
              <p className="mt-3 text-4xl font-bold">
                {loading ? "..." : planningStats.completedSessions}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Pending Sessions</p>
              <p className="mt-3 text-4xl font-bold">
                {loading ? "..." : planningStats.pendingSessions}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Active Tasks</p>
              <p className="mt-3 text-4xl font-bold">
                {loading ? "..." : incompleteTasks.length}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
                AI Planning Insight
              </div>

              <h2 className="mt-4 text-3xl font-semibold">
                {loading
                  ? "Loading your plan..."
                  : planningStats.nextTask
                    ? "Your next most important task is already being prioritised"
                    : "You’re ready to build your next study cycle"}
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                {loading
                  ? "Syncing tasks and study sessions from your account."
                  : planningStats.nextTask
                    ? `Your upcoming work is being scheduled around ${planningStats.nextTask.module}. The planner is weighting urgency and priority first, then fitting sessions into your available study windows.`
                    : "Once you add tasks, LockdIn will generate a balanced weekly study plan automatically."}
              </p>

              {planningStats.nextTask ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Most urgent task
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">
                        {planningStats.nextTask.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {planningStats.nextTask.module}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(
                        planningStats.nextTask.priority
                      )}`}
                    >
                      {planningStats.nextTask.priority}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {getUrgencyLabel(getDaysUntil(planningStats.nextTask.dueDate))}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <h2 className="text-2xl font-semibold">Planning Notes</h2>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-slate-950 p-5">
                  <p className="text-sm text-slate-400">How sessions are chosen</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    LockdIn schedules incomplete tasks first, then ranks them by
                    priority, deadline urgency, and your available study windows.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950 p-5">
                  <p className="text-sm text-slate-400">Best use of this page</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Set your realistic availability, choose where you work best,
                    then regenerate the plan whenever your week changes.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950 p-5">
                  <p className="text-sm text-slate-400">When to regenerate</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Regenerate your plan after adding urgent tasks, changing free
                    time, or switching your preferred study location.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
              Loading your planner...
            </div>
          ) : studyPlan.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
              Add tasks and set at least one available day and one time slot to generate your study plan.
            </div>
          ) : (
            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-3xl font-semibold">This Week’s Study Plan</h2>
                <p className="text-sm text-slate-400">
                  Click a session to mark it complete
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {studyPlan.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() =>
                      toggleSessionComplete(session.id, session.completed)
                    }
                    className={`rounded-2xl border p-6 text-left transition ${
                      session.completed
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900 hover:border-blue-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-400">{session.day}</p>
                        <h3 className="mt-2 text-2xl font-semibold">
                          {session.subject}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          session.completed
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-blue-500/15 text-blue-300"
                        }`}
                      >
                        {session.completed ? "Completed" : "Planned"}
                      </span>
                    </div>

                    <p className="mt-3 text-blue-400">{session.time}</p>
                    <p className="mt-4 text-slate-300">{session.focus}</p>
                    <p className="mt-3 text-sm text-slate-400">
                      Location: {session.location}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {session.duration_minutes} minute focus block
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}