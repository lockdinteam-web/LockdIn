"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Trash2,
  CalendarDays,
  BookOpen,
  Flag,
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

const STORAGE_KEY = "lockdin_tasks";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [module, setModule] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");

  useEffect(() => {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch {
        setTasks([]);
      }
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!title.trim() || !module.trim() || !dueDate) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      module: module.trim(),
      dueDate,
      priority,
      completed: false,
    };

    setTasks((prev) => [newTask, ...prev]);
    setTitle("");
    setModule("");
    setDueDate("");
    setPriority("Medium");
  }

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const activeTasks = totalTasks - completedTasks;

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks]);

  function getPriorityClasses(priority: Priority) {
    switch (priority) {
      case "High":
        return "bg-red-500/15 text-red-300 border border-red-500/20";
      case "Medium":
        return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
      case "Low":
        return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
      default:
        return "bg-slate-500/15 text-slate-300 border border-slate-500/20";
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

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-8 xl:px-10">
          <div className="mb-10 flex flex-col gap-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                  Workspace
                </p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
                  Your Tasks
                </h1>
                <p className="mt-3 max-w-2xl text-slate-400">
                  Add tasks, track deadlines, and keep on top of your workload
                  with a cleaner, more focused view.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <ClipboardList className="h-4 w-4 text-blue-400" />
                {activeTasks} active task{activeTasks !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/20">
                <p className="text-sm text-slate-400">Total Tasks</p>
                <h2 className="mt-2 text-3xl font-bold">{totalTasks}</h2>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/20">
                <p className="text-sm text-slate-400">Active</p>
                <h2 className="mt-2 text-3xl font-bold text-blue-400">
                  {activeTasks}
                </h2>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/20">
                <p className="text-sm text-slate-400">Completed</p>
                <h2 className="mt-2 text-3xl font-bold text-emerald-400">
                  {completedTasks}
                </h2>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleAddTask}
            className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-black/20"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/15 p-3">
                <Plus className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Add New Task</h2>
                <p className="text-sm text-slate-400">
                  Create a task with a title, module, deadline, and priority.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400">Task Title</label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:border-blue-500/50">
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

              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400">Module</label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:border-blue-500/50">
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
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:border-blue-500/50">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-transparent text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400">Priority</label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:border-blue-500/50">
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

            <button
              type="submit"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </form>

          <div className="space-y-4">
            {tasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/70 p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
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
                  className="group rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/10 transition hover:border-slate-700 hover:bg-slate-900"
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

                      <div>
                        <h2
                          className={`text-xl font-semibold transition ${
                            task.completed
                              ? "text-slate-500 line-through"
                              : "text-white"
                          }`}
                        >
                          {task.title}
                        </h2>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                          <span className="rounded-full bg-slate-800 px-3 py-1">
                            {task.module}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1">
                            Due: {formatDate(task.dueDate)}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-sm ${getPriorityClasses(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
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
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
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
        </div>
      </div>
    </AppShell>
  );
}