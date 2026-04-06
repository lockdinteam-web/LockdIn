"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";

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
  taskId: string;
  durationMinutes: number;
  completed: boolean;
  location: string;
};

type PlannerPreferences = {
  availableDays: string[];
  availableTimeSlots: string[];
  preferredLocation: string;
};

const TASKS_STORAGE_KEY = "lockdin_tasks";
const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";
const PLANNER_PREFERENCES_KEY = "lockdin_planner_preferences";

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
): StudyBlock[] {
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
        id: `${task.id}-${slot.day}-${slot.time}`,
        day: slot.day,
        time: slot.time,
        subject: task.module,
        focus: task.title,
        taskId: task.id,
        durationMinutes: 90,
        completed: false,
        location: preferences.preferredLocation || "Study space",
      };
    });
}

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyBlock[]>([]);
  const [preferences, setPreferences] =
    useState<PlannerPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const savedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
    const savedPlan = localStorage.getItem(STUDY_PLAN_STORAGE_KEY);
    const savedPreferences = localStorage.getItem(PLANNER_PREFERENCES_KEY);

    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch {
        setTasks([]);
      }
    }

    if (savedPlan) {
      try {
        setStudyPlan(JSON.parse(savedPlan));
      } catch {
        setStudyPlan([]);
      }
    }

    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch {
        setPreferences(defaultPreferences);
      }
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STUDY_PLAN_STORAGE_KEY, JSON.stringify(studyPlan));
  }, [studyPlan, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      PLANNER_PREFERENCES_KEY,
      JSON.stringify(preferences)
    );
  }, [preferences, loaded]);

  const incompleteTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks]
  );

  const planningStats = useMemo(() => {
    const completedSessions = studyPlan.filter((session) => session.completed).length;
    const pendingSessions = studyPlan.filter((session) => !session.completed).length;
    const totalHours = Math.round((studyPlan.length * 90) / 60);

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

  function regeneratePlan() {
    setStudyPlan(buildStudyPlan(tasks, preferences));
  }

  function toggleSessionComplete(id: string) {
    setStudyPlan((prev) =>
      prev.map((session) =>
        session.id === id
          ? { ...session, completed: !session.completed }
          : session
      )
    );
  }

  function toggleAvailableDay(day: string) {
    setPreferences((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((item) => item !== day)
        : [...prev.availableDays, day],
    }));
  }

  function toggleAvailableTimeSlot(slot: string) {
    setPreferences((prev) => ({
      ...prev,
      availableTimeSlots: prev.availableTimeSlots.includes(slot)
        ? prev.availableTimeSlots.filter((item) => item !== slot)
        : [...prev.availableTimeSlots, slot],
    }));
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
                {planningStats.totalHours} planned study hour
                {planningStats.totalHours === 1 ? "" : "s"}
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
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        preferredLocation: e.target.value,
                      }))
                    }
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
              <p className="mt-3 text-4xl font-bold">{studyPlan.length}</p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Completed Sessions</p>
              <p className="mt-3 text-4xl font-bold">
                {planningStats.completedSessions}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Pending Sessions</p>
              <p className="mt-3 text-4xl font-bold">
                {planningStats.pendingSessions}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Active Tasks</p>
              <p className="mt-3 text-4xl font-bold">{incompleteTasks.length}</p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
                AI Planning Insight
              </div>

              <h2 className="mt-4 text-3xl font-semibold">
                {planningStats.nextTask
                  ? "Your next most important task is already being prioritised"
                  : "You’re ready to build your next study cycle"}
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                {planningStats.nextTask
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

          {studyPlan.length === 0 ? (
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
                    onClick={() => toggleSessionComplete(session.id)}
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
                      {session.durationMinutes} minute focus block
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