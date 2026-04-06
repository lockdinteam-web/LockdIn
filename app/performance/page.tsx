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
};

const TASKS_STORAGE_KEY = "lockdin_tasks";
const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getPriorityClass(priority: Priority) {
  if (priority === "High") return "bg-rose-500/15 text-rose-300";
  if (priority === "Medium") return "bg-amber-500/15 text-amber-300";
  return "bg-emerald-500/15 text-emerald-300";
}

function safeParseArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PerformancePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyBlock[]>([]);

  useEffect(() => {
    setTasks(safeParseArray<Task>(localStorage.getItem(TASKS_STORAGE_KEY)));
    setStudyPlan(
      safeParseArray<StudyBlock>(localStorage.getItem(STUDY_PLAN_STORAGE_KEY))
    );
  }, []);

  const analytics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.completed).length;
    const pendingTasks = tasks.filter((task) => !task.completed).length;
    const overdueTasks = tasks.filter(
      (task) => !task.completed && getDaysUntil(task.dueDate) < 0
    ).length;
    const highPriorityOpen = tasks.filter(
      (task) => !task.completed && task.priority === "High"
    ).length;

    const taskCompletionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalSessions = studyPlan.length;
    const completedSessions = studyPlan.filter((session) => session.completed).length;
    const plannerCompletionRate =
      totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    const totalPlannedHours =
      Math.round(
        (studyPlan.reduce((sum, session) => sum + session.durationMinutes, 0) / 60) *
          10
      ) / 10;

    const momentumScore =
      Math.round(taskCompletionRate * 0.65 + plannerCompletionRate * 0.35);

    const consistencyScore =
      overdueTasks > 0
        ? Math.max(20, momentumScore - overdueTasks * 10)
        : Math.min(100, momentumScore + 10);

    const moduleMap = new Map<
      string,
      {
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        highPriority: number;
        sessions: number;
        completedSessions: number;
        plannedMinutes: number;
      }
    >();

    for (const task of tasks) {
      const key = task.module.trim() || "General";
      const current = moduleMap.get(key) ?? {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        highPriority: 0,
        sessions: 0,
        completedSessions: 0,
        plannedMinutes: 0,
      };

      current.totalTasks += 1;
      if (task.completed) current.completedTasks += 1;
      if (!task.completed) current.pendingTasks += 1;
      if (!task.completed && task.priority === "High") current.highPriority += 1;

      moduleMap.set(key, current);
    }

    for (const session of studyPlan) {
      const key = session.subject.trim() || "General";
      const current = moduleMap.get(key) ?? {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        highPriority: 0,
        sessions: 0,
        completedSessions: 0,
        plannedMinutes: 0,
      };

      current.sessions += 1;
      current.plannedMinutes += session.durationMinutes;
      if (session.completed) current.completedSessions += 1;

      moduleMap.set(key, current);
    }

    const moduleStats = Array.from(moduleMap.entries())
      .map(([module, value]) => ({
        module,
        ...value,
        taskCompletionRate:
          value.totalTasks > 0
            ? Math.round((value.completedTasks / value.totalTasks) * 100)
            : 0,
        plannerCompletionRate:
          value.sessions > 0
            ? Math.round((value.completedSessions / value.sessions) * 100)
            : 0,
        plannedHours: Math.round((value.plannedMinutes / 60) * 10) / 10,
      }))
      .sort((a, b) => b.pendingTasks + b.highPriority - (a.pendingTasks + a.highPriority));

    const mostPressuredModule = moduleStats[0] ?? null;
    const strongestModule =
      [...moduleStats].sort((a, b) => b.taskCompletionRate - a.taskCompletionRate)[0] ??
      null;

    let coachTitle = "Your performance is stable";
    let coachSummary =
      "Your workload is under reasonable control. The next gain comes from staying consistent.";
    let coachAction =
      "Work through your next planned session and keep your completion rate climbing.";

    if (overdueTasks > 0) {
      coachTitle = "Overdue work is your biggest risk";
      coachSummary = `You currently have ${overdueTasks} overdue task${
        overdueTasks === 1 ? "" : "s"
      }, which is dragging down your overall performance.`;
      coachAction =
        "Clear the most overdue task first, then return to your normal study plan.";
    } else if (highPriorityOpen > 0) {
      coachTitle = "High-priority pressure needs attention";
      coachSummary = `You still have ${highPriorityOpen} high-priority task${
        highPriorityOpen === 1 ? "" : "s"
      } open. Your best move is focused execution, not more planning.`;
      coachAction =
        "Finish one high-priority task before switching to lower-value work.";
    } else if (plannerCompletionRate < 40 && totalSessions > 0) {
      coachTitle = "Your plan exists, but follow-through is weak";
      coachSummary =
        "You’ve built study structure, but session completion is still low. Performance improves when the plan gets executed.";
      coachAction =
        "Complete your next scheduled study block before regenerating the plan.";
    } else if (taskCompletionRate >= 75 && plannerCompletionRate >= 60) {
      coachTitle = "You’re building strong academic momentum";
      coachSummary =
        "Both your task completion and study plan follow-through are healthy. Focus on protecting consistency.";
      coachAction =
        "Stay steady and keep using the planner to stay ahead of deadline pressure.";
    }

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      highPriorityOpen,
      taskCompletionRate,
      totalSessions,
      completedSessions,
      plannerCompletionRate,
      totalPlannedHours,
      momentumScore,
      consistencyScore,
      moduleStats,
      mostPressuredModule,
      strongestModule,
      coachTitle,
      coachSummary,
      coachAction,
      recentTasks: tasks.slice(0, 6),
      recentSessions: studyPlan.slice(0, 6),
    };
  }, [tasks, studyPlan]);

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#08122b_0%,#061021_100%)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Performance
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              State-of-the-art academic performance view
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              See how your tasks and study plan work together across completion,
              workload pressure, momentum, and module balance.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Task Completion</p>
              <p className="mt-3 text-4xl font-bold">
                {analytics.taskCompletionRate}%
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Planner Completion</p>
              <p className="mt-3 text-4xl font-bold">
                {analytics.plannerCompletionRate}%
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Planned Hours</p>
              <p className="mt-3 text-4xl font-bold">
                {analytics.totalPlannedHours}h
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Overdue Tasks</p>
              <p className="mt-3 text-4xl font-bold">{analytics.overdueTasks}</p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
                AI Performance Coach
              </div>
              <h2 className="mt-4 text-3xl font-semibold">
                {analytics.coachTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                {analytics.coachSummary}
              </p>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Recommended next step
                </p>
                <p className="mt-3 text-sm leading-7 text-white">
                  {analytics.coachAction}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm text-slate-400">Momentum Score</p>
                <p className="mt-3 text-4xl font-bold">{analytics.momentumScore}</p>
                <div className="mt-4 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${analytics.momentumScore}%` }}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm text-slate-400">Consistency Score</p>
                <p className="mt-3 text-4xl font-bold">
                  {analytics.consistencyScore}
                </p>
                <div className="mt-4 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${analytics.consistencyScore}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Module Breakdown</h2>
                <span className="text-sm text-slate-400">
                  {analytics.moduleStats.length} module
                  {analytics.moduleStats.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {analytics.moduleStats.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">
                    No task or planner data yet.
                  </div>
                ) : (
                  analytics.moduleStats.map((module) => (
                    <div
                      key={module.module}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold">{module.module}</p>
                          <p className="mt-2 text-sm text-slate-400">
                            {module.completedTasks} completed • {module.pendingTasks} pending
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {module.sessions} study block
                            {module.sessions === 1 ? "" : "s"} • {module.plannedHours}h
                            planned
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-semibold">
                            {module.taskCompletionRate}%
                          </p>
                          <p className="text-xs text-slate-500">task completion</p>
                        </div>
                      </div>

                      <div className="mt-4 h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${module.taskCompletionRate}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                <h2 className="text-2xl font-semibold">Pressure Signals</h2>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">Most Pressured Module</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analytics.mostPressuredModule?.module ?? "No data yet"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">Strongest Module</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analytics.strongestModule?.module ?? "No data yet"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">High Priority Open</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analytics.highPriorityOpen}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                <h2 className="text-2xl font-semibold">Planner Signals</h2>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">Sessions Planned</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analytics.totalSessions}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">Sessions Completed</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analytics.completedSessions}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">Open Workload</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analytics.pendingTasks} active task
                      {analytics.pendingTasks === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <h2 className="text-2xl font-semibold">Recent Task Activity</h2>

              <div className="mt-6 space-y-4">
                {analytics.recentTasks.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">
                    No task activity yet.
                  </div>
                ) : (
                  analytics.recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p
                            className={`font-medium ${
                              task.completed ? "text-slate-500 line-through" : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {task.module} • Due {task.dueDate}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(
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

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <h2 className="text-2xl font-semibold">Recent Planner Activity</h2>

              <div className="mt-6 space-y-4">
                {analytics.recentSessions.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">
                    No planner activity yet.
                  </div>
                ) : (
                  analytics.recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">{session.focus}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {session.subject} • {session.day}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {session.time}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            session.completed
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-blue-500/15 text-blue-300"
                          }`}
                        >
                          {session.completed ? "Done" : "Planned"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}