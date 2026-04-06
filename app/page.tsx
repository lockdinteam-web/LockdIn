"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Priority = "High" | "Medium" | "Low";

type Task = {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

const STORAGE_KEY = "lockdin_tasks";

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getPriorityBadge(priority: Priority) {
  if (priority === "High") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20";
  }
  if (priority === "Medium") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20";
  }
  return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20";
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch {
        setTasks([]);
      }
    }
  }, []);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.completed).length;
    const pending = tasks.filter((task) => !task.completed).length;
    const highPriority = tasks.filter(
      (task) => !task.completed && task.priority === "High"
    ).length;

    const overdue = tasks.filter(
      (task) => !task.completed && getDaysUntil(task.dueDate) < 0
    ).length;

    const upcoming = [...tasks]
      .filter((task) => !task.completed)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const nextTask = upcoming[0] ?? null;

    const completionRate =
      tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    return {
      completed,
      pending,
      highPriority,
      overdue,
      nextTask,
      completionRate,
      recent: tasks.slice(0, 5),
    };
  }, [tasks]);

  const coachTitle =
    stats.overdue > 0
      ? "Your top priority is clearing overdue work"
      : stats.highPriority > 0
      ? "Your top priority is your high-priority tasks"
      : stats.pending > 0
      ? "Your focus today is steady execution"
      : "You’re in a strong position today";

  const coachMessage =
    stats.overdue > 0
      ? `You have ${stats.overdue} overdue task${
          stats.overdue === 1 ? "" : "s"
        }. Clear those first before adding anything new.`
      : stats.highPriority > 0
      ? `You have ${stats.highPriority} high-priority task${
          stats.highPriority === 1 ? "" : "s"
        } still open. Focus on finishing those before lower-value work.`
      : stats.pending > 0
      ? `You currently have ${stats.pending} active task${
          stats.pending === 1 ? "" : "s"
        }. Stay consistent and complete what is already in motion.`
      : "Your current workload is clear. This is a good moment to plan ahead and protect momentum.";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="space-y-5 sm:space-y-8">
          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#08122b_0%,#061021_100%)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:rounded-[32px] sm:p-8 md:p-10">
            <div className="flex flex-col gap-8 sm:gap-10 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 sm:px-4 sm:text-sm">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  Academic productivity system
                </div>

                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:mt-6 sm:text-4xl md:text-5xl xl:text-6xl">
                  Study smarter. Stay organised. Perform better.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:mt-5 sm:text-base sm:leading-8 md:text-lg">
                  LockdIn gives you a cleaner way to manage tasks, structure study
                  time, and keep momentum high without losing sight of deadlines.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:gap-4">
                  <Link
                    href="/tasks"
                    className="w-full rounded-2xl bg-blue-500 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-blue-400 sm:w-auto"
                  >
                    Add a task
                  </Link>
                  <Link
                    href="/planner"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    Open planner
                  </Link>
                  <Link
                    href="/performance"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    View performance
                  </Link>
                </div>
              </div>

              <div className="relative flex justify-center xl:min-w-[360px] xl:justify-end">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-52 w-52 rounded-full bg-blue-500/15 blur-3xl sm:h-64 sm:w-64 md:h-80 md:w-80" />
                </div>

                <div className="relative w-full max-w-[320px] rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:max-w-none sm:rounded-[32px] sm:p-5">
                  <div className="absolute -left-1 top-3 rounded-2xl border border-white/10 bg-[#101b38]/95 px-3 py-2 shadow-lg backdrop-blur sm:-left-3 sm:top-4 sm:px-4 sm:py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Focus
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white md:text-base">
                      Deep Work
                    </p>
                  </div>

                  <div className="absolute -right-1 bottom-3 rounded-2xl border border-white/10 bg-[#101b38]/95 px-3 py-2 shadow-lg backdrop-blur sm:-right-3 sm:bottom-4 sm:px-4 sm:py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Momentum
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-300 md:text-base">
                      Locked In
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-[#0d1730] p-4 shadow-inner sm:rounded-[28px] sm:p-5">
                    <div className="rounded-[18px] bg-white p-4 sm:rounded-[20px] sm:p-5">
                      <Image
                        src="/logo.png"
                        alt="LockdIn logo"
                        width={260}
                        height={260}
                        className="mx-auto h-auto w-[160px] object-contain sm:w-[190px] md:w-[240px]"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Total tasks</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">{tasks.length}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Completed</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">{stats.completed}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">High priority</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">{stats.highPriority}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Completion rate</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">{stats.completionRate}%</p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                    AI Coach
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {coachTitle}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                    {coachMessage}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:min-w-[240px]">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Recommended next step
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white">
                    {stats.overdue > 0
                      ? "Open Tasks and complete the most overdue item first."
                      : stats.highPriority > 0
                      ? "Finish your next high-priority task before switching context."
                      : stats.pending > 0
                      ? "Use Planner to assign focused time to your remaining workload."
                      : "Use Planner to map out your next study block while you’re ahead."}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                <Link
                  href="/tasks"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200 transition hover:border-blue-400"
                >
                  Open Tasks
                </Link>
                <Link
                  href="/planner"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200 transition hover:border-blue-400"
                >
                  Build study plan
                </Link>
                <Link
                  href="/performance"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200 transition hover:border-blue-400"
                >
                  Review performance
                </Link>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <h3 className="text-xl font-semibold sm:text-2xl">Next up</h3>

              {stats.nextTask ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#101b38] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold break-words">{stats.nextTask.title}</p>
                      <p className="mt-2 text-sm text-slate-400">
                        {stats.nextTask.module}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
                        stats.nextTask.priority
                      )}`}
                    >
                      {stats.nextTask.priority}
                    </span>
                  </div>

                  <p className="mt-5 text-sm text-slate-300">
                    Due {stats.nextTask.dueDate}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    {getDaysUntil(stats.nextTask.dueDate) < 0
                      ? "This task is overdue."
                      : getDaysUntil(stats.nextTask.dueDate) === 0
                      ? "Due today."
                      : getDaysUntil(stats.nextTask.dueDate) === 1
                      ? "Due tomorrow."
                      : `Due in ${getDaysUntil(stats.nextTask.dueDate)} days.`}
                  </p>

                  <Link
                    href="/tasks"
                    className="mt-6 inline-flex w-full justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400 sm:w-auto"
                  >
                    Go to tasks
                  </Link>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#101b38] p-5 text-slate-300 sm:p-6">
                  No pending tasks yet. Add your first task to start building momentum.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Recent Tasks</h3>
                <Link
                  href="/tasks"
                  className="shrink-0 text-sm font-medium text-blue-400 transition hover:text-blue-300"
                >
                  View all
                </Link>
              </div>

              <div className="mt-6 space-y-4">
                {stats.recent.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    No tasks yet. Add your first task to get started.
                  </div>
                ) : (
                  stats.recent.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-[#101b38] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p
                            className={`text-base font-medium break-words ${
                              task.completed ? "text-slate-500 line-through" : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-400">{task.module}</p>
                          <p className="mt-2 text-sm text-slate-500">
                            Due: {task.dueDate}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
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

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <h3 className="text-xl font-semibold sm:text-2xl">Quick Access</h3>

              <div className="mt-6 grid gap-4">
                <Link
                  href="/tasks"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 transition hover:border-blue-400 sm:p-5"
                >
                  <p className="text-lg font-medium">Tasks</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Add work, manage deadlines, and update progress.
                  </p>
                </Link>

                <Link
                  href="/planner"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 transition hover:border-blue-400 sm:p-5"
                >
                  <p className="text-lg font-medium">Planner</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Build realistic study blocks around your workload.
                  </p>
                </Link>

                <Link
                  href="/performance"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 transition hover:border-blue-400 sm:p-5"
                >
                  <p className="text-lg font-medium">Performance</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Track progress, completion trends, and momentum.
                  </p>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}