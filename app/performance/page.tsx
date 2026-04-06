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

type CookedResult = {
  score: number;
  status: string;
  headline: string;
  reasons: string[];
};

type RecoveryAction = {
  type: "task" | "studyBlock";
  id: string;
  label: string;
  scoreDrop: number;
  route: string;
};

type ActiveFilter =
  | "all"
  | "cooked"
  | "momentum"
  | "consistency"
  | "overdue"
  | "urgent"
  | "highPriority";

const TASKS_STORAGE_KEY = "lockdin_tasks";
const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";

function safeParseArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysUntil(dateString: string) {
  const today = startOfToday();
  const due = new Date(dateString);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function priorityWeight(priority: Priority) {
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

function getPriorityClass(priority: Priority) {
  if (priority === "High") return "bg-rose-500/15 text-rose-300";
  if (priority === "Medium") return "bg-amber-500/15 text-amber-300";
  return "bg-emerald-500/15 text-emerald-300";
}

function getCookedStatus(score: number) {
  if (score <= 20) return "Chill";
  if (score <= 40) return "Stable";
  if (score <= 60) return "Wobbling";
  if (score <= 80) return "Cooked";
  return "Deep Fried";
}

function getCookedHeadline(score: number) {
  if (score <= 20) return "You’re in a good spot. Keep the momentum going.";
  if (score <= 40) return "Things are under control, but don’t get lazy.";
  if (score <= 60) return "Pressure is building. A solid session today would help.";
  if (score <= 80) return "You are officially cooked unless you act now.";
  return "This is salvageable, but only if you lock in immediately.";
}

function getDeadlineUrgencyScore(days: number, priority: Priority) {
  const weight = priorityWeight(priority);

  if (days < 0) return 12 * weight;
  if (days === 0) return 10 * weight;
  if (days === 1) return 8 * weight;
  if (days <= 3) return 6 * weight;
  if (days <= 7) return 4 * weight;
  if (days <= 14) return 2 * weight;
  return 1 * weight;
}

function calculateCookedScore(
  tasks: Task[],
  studyBlocks: StudyBlock[]
): CookedResult {
  const incompleteTasks = tasks.filter((task) => !task.completed);
  const reasons: string[] = [];

  let overdueScore = 0;
  let deadlinePressureScore = 0;
  let priorityScore = 0;
  let workloadScore = 0;
  let missedStudyScore = 0;

  const overdueTasks = incompleteTasks.filter((task) => getDaysUntil(task.dueDate) < 0);

  const dueSoonTasks = incompleteTasks.filter((task) => {
    const days = getDaysUntil(task.dueDate);
    return days >= 0 && days <= 7;
  });

  const highPriorityOpen = incompleteTasks.filter(
    (task) => task.priority === "High"
  ).length;

  const mediumPriorityOpen = incompleteTasks.filter(
    (task) => task.priority === "Medium"
  ).length;

  const missedBlocks = studyBlocks.filter((block) => !block.completed);

  overdueScore = Math.min(
    35,
    overdueTasks.reduce(
      (sum, task) => sum + 8 * priorityWeight(task.priority),
      0
    )
  );

  if (overdueTasks.length > 0) {
    reasons.push(
      `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`
    );
  }

  deadlinePressureScore = Math.min(
    30,
    incompleteTasks.reduce((sum, task) => {
      const days = getDaysUntil(task.dueDate);
      return sum + getDeadlineUrgencyScore(days, task.priority);
    }, 0)
  );

  if (dueSoonTasks.length > 0) {
    reasons.push(
      `${dueSoonTasks.length} deadline${dueSoonTasks.length === 1 ? "" : "s"} in the next 7 days`
    );
  }

  priorityScore = Math.min(15, highPriorityOpen * 4 + mediumPriorityOpen * 2);

  if (highPriorityOpen > 0) {
    reasons.push(
      `${highPriorityOpen} high-priority task${highPriorityOpen === 1 ? "" : "s"} still open`
    );
  }

  const incompleteCount = incompleteTasks.length;

  if (incompleteCount <= 2) {
    workloadScore = incompleteCount * 2;
  } else if (incompleteCount <= 4) {
    workloadScore = 4 + (incompleteCount - 2) * 3;
  } else if (incompleteCount <= 7) {
    workloadScore = 10 + (incompleteCount - 4) * 4;
  } else {
    workloadScore = 22 + (incompleteCount - 7) * 5;
  }

  workloadScore = Math.min(25, workloadScore);

  if (incompleteCount >= 4) {
    reasons.push(`${incompleteCount} unfinished tasks building up`);
  }

  missedStudyScore = Math.min(15, missedBlocks.length * 3);

  if (missedBlocks.length > 0) {
    reasons.push(
      `${missedBlocks.length} study block${missedBlocks.length === 1 ? "" : "s"} not completed`
    );
  }

  const rawScore =
    overdueScore +
    deadlinePressureScore +
    priorityScore +
    workloadScore +
    missedStudyScore;

  const score = Math.max(0, Math.min(100, rawScore));
  const status = getCookedStatus(score);
  const headline = getCookedHeadline(score);

  return {
    score,
    status,
    headline,
    reasons:
      reasons.length > 0 ? reasons.slice(0, 4) : ["No major risk factors right now"],
  };
}

function getBestRecoveryAction(
  tasks: Task[],
  studyBlocks: StudyBlock[]
): RecoveryAction | null {
  const currentScore = calculateCookedScore(tasks, studyBlocks).score;
  const actions: RecoveryAction[] = [];

  for (const task of tasks) {
    if (task.completed) continue;

    const simulatedTasks = tasks.map((currentTask) =>
      currentTask.id === task.id ? { ...currentTask, completed: true } : currentTask
    );

    const newScore = calculateCookedScore(simulatedTasks, studyBlocks).score;
    const scoreDrop = Math.max(0, currentScore - newScore);

    actions.push({
      type: "task",
      id: task.id,
      label: `Finish "${task.title}"`,
      scoreDrop,
      route: "/tasks",
    });
  }

  for (const block of studyBlocks) {
    if (block.completed) continue;

    const simulatedBlocks = studyBlocks.map((currentBlock) =>
      currentBlock.id === block.id ? { ...currentBlock, completed: true } : currentBlock
    );

    const newScore = calculateCookedScore(tasks, simulatedBlocks).score;
    const scoreDrop = Math.max(0, currentScore - newScore);

    actions.push({
      type: "studyBlock",
      id: block.id,
      label: `Complete ${block.subject} study block`,
      scoreDrop,
      route: "/planner",
    });
  }

  if (actions.length === 0) return null;

  actions.sort((a, b) => {
    if (b.scoreDrop !== a.scoreDrop) return b.scoreDrop - a.scoreDrop;
    if (a.type !== b.type) return a.type === "task" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return actions[0];
}

function getScoreTone(score: number) {
  if (score >= 80) {
    return {
      label: "Critical",
      pill: "bg-rose-500/15 text-rose-300",
      bar: "bg-rose-500",
      ring: "ring-rose-500/30",
    };
  }
  if (score >= 60) {
    return {
      label: "High",
      pill: "bg-orange-500/15 text-orange-300",
      bar: "bg-orange-500",
      ring: "ring-orange-500/30",
    };
  }
  if (score >= 40) {
    return {
      label: "Moderate",
      pill: "bg-amber-500/15 text-amber-300",
      bar: "bg-amber-500",
      ring: "ring-amber-500/30",
    };
  }
  return {
    label: "Healthy",
    pill: "bg-emerald-500/15 text-emerald-300",
    bar: "bg-emerald-500",
    ring: "ring-emerald-500/30",
  };
}

function getMomentumLabel(score: number) {
  if (score >= 80) return "Locked In";
  if (score >= 60) return "Building";
  if (score >= 40) return "Patchy";
  return "Flat";
}

function getConsistencyLabel(score: number) {
  if (score >= 80) return "Reliable";
  if (score >= 60) return "Decent";
  if (score >= 40) return "Uneven";
  return "Chaotic";
}

function InfoIconButton({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs transition ${
        isOpen
          ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
          : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
      }`}
      aria-label="Show score info"
    >
      i
    </button>
  );
}

function ScoreCard({
  title,
  score,
  subtitle,
  label,
  barClass,
  accentPillClass,
  isActive,
  onActivate,
  infoOpen,
  onToggleInfo,
  infoTitle,
  infoBody,
  tips,
}: {
  title: string;
  score: number;
  subtitle: string;
  label: string;
  barClass: string;
  accentPillClass: string;
  isActive: boolean;
  onActivate: () => void;
  infoOpen: boolean;
  onToggleInfo: () => void;
  infoTitle: string;
  infoBody: string;
  tips: string[];
}) {
  return (
    <div
      className={`rounded-3xl border bg-slate-900 p-6 transition ${
        isActive
          ? "border-blue-500/40 ring-1 ring-blue-500/30"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onActivate}
          className="flex-1 text-left"
        >
          <p className="text-sm text-slate-400">{title}</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-4xl font-bold">{score}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${accentPillClass}`}>
              {label}
            </span>
          </div>
        </button>

        <InfoIconButton onClick={onToggleInfo} isOpen={infoOpen} />
      </div>

      <button
        type="button"
        onClick={onActivate}
        className="mt-4 block w-full text-left"
      >
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className={`h-2 rounded-full ${barClass} transition-all duration-500`}
            style={{ width: `${score}%` }}
          />
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-300">{subtitle}</p>
      </button>

      {infoOpen && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/80 p-4">
          <p className="text-sm font-semibold text-white">{infoTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{infoBody}</p>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/70 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          Best way to improve it
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {tips.map((tip) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyBlock[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [openInfoCard, setOpenInfoCard] = useState<
    "cooked" | "momentum" | "consistency" | null
  >(null);

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

    const dueTodayOrTomorrow = tasks.filter((task) => {
      if (task.completed) return false;
      const days = getDaysUntil(task.dueDate);
      return days >= 0 && days <= 1;
    }).length;

    const highPriorityOpen = tasks.filter(
      (task) => !task.completed && task.priority === "High"
    ).length;

    const mediumPriorityOpen = tasks.filter(
      (task) => !task.completed && task.priority === "Medium"
    ).length;

    const taskCompletionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalSessions = studyPlan.length;
    const completedSessions = studyPlan.filter((session) => session.completed).length;
    const openSessions = studyPlan.filter((session) => !session.completed).length;

    const plannerCompletionRate =
      totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    const totalPlannedHours =
      Math.round(
        (studyPlan.reduce((sum, session) => sum + session.durationMinutes, 0) / 60) *
          10
      ) / 10;

    const cooked = calculateCookedScore(tasks, studyPlan);
    const bestRecoveryAction = getBestRecoveryAction(tasks, studyPlan);

    const momentumBase = Math.round(
      taskCompletionRate * 0.5 +
        plannerCompletionRate * 0.25 +
        Math.max(0, 25 - overdueTasks * 8) +
        Math.max(0, 15 - highPriorityOpen * 4)
    );

    const momentumScore = Math.max(0, Math.min(100, momentumBase));

    const consistencyBase = Math.round(
      100 -
        overdueTasks * 18 -
        dueTodayOrTomorrow * 8 -
        openSessions * 3 -
        Math.max(0, pendingTasks - 3) * 4
    );

    const consistencyScore = Math.max(0, Math.min(100, consistencyBase));

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

    if (cooked.score >= 80) {
      coachTitle = "You need to reduce pressure fast";
      coachSummary =
        "Your cooked score is high because urgent unfinished work is stacking up. The best move now is damage control, not perfect planning.";
      coachAction =
        bestRecoveryAction?.label ??
        "Finish one urgent task today to bring the pressure down.";
    } else if (overdueTasks > 0) {
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

    const recentTasks = tasks.slice(0, 6);
    const recentSessions = studyPlan.slice(0, 6);

    const filteredTasks = (() => {
      if (activeFilter === "all") return recentTasks;

      if (activeFilter === "overdue") {
        return tasks
          .filter((task) => !task.completed && getDaysUntil(task.dueDate) < 0)
          .slice(0, 6);
      }

      if (activeFilter === "urgent") {
        return tasks
          .filter((task) => {
            if (task.completed) return false;
            const days = getDaysUntil(task.dueDate);
            return days >= 0 && days <= 1;
          })
          .slice(0, 6);
      }

      if (activeFilter === "highPriority") {
        return tasks
          .filter((task) => !task.completed && task.priority === "High")
          .slice(0, 6);
      }

      if (activeFilter === "cooked") {
        return tasks
          .filter((task) => !task.completed)
          .sort((a, b) => {
            const aScore =
              getDeadlineUrgencyScore(getDaysUntil(a.dueDate), a.priority) +
              priorityWeight(a.priority) * 4;
            const bScore =
              getDeadlineUrgencyScore(getDaysUntil(b.dueDate), b.priority) +
              priorityWeight(b.priority) * 4;
            return bScore - aScore;
          })
          .slice(0, 6);
      }

      if (activeFilter === "momentum") {
        return tasks
          .filter((task) => !task.completed)
          .sort((a, b) => {
            const aDays = getDaysUntil(a.dueDate);
            const bDays = getDaysUntil(b.dueDate);
            const aValue =
              (aDays < 0 ? 50 : aDays <= 3 ? 30 : 10) +
              (a.priority === "High" ? 20 : a.priority === "Medium" ? 10 : 5);
            const bValue =
              (bDays < 0 ? 50 : bDays <= 3 ? 30 : 10) +
              (b.priority === "High" ? 20 : b.priority === "Medium" ? 10 : 5);
            return bValue - aValue;
          })
          .slice(0, 6);
      }

      if (activeFilter === "consistency") {
        return tasks
          .filter((task) => !task.completed)
          .sort((a, b) => {
            const aDays = getDaysUntil(a.dueDate);
            const bDays = getDaysUntil(b.dueDate);
            const aValue = (aDays < 0 ? 60 : aDays <= 1 ? 40 : aDays <= 3 ? 20 : 5);
            const bValue = (bDays < 0 ? 60 : bDays <= 1 ? 40 : bDays <= 3 ? 20 : 5);
            return bValue - aValue;
          })
          .slice(0, 6);
      }

      return recentTasks;
    })();

    const filteredSessions = (() => {
      if (activeFilter === "all") return recentSessions;

      if (activeFilter === "momentum" || activeFilter === "consistency" || activeFilter === "cooked") {
        return studyPlan.filter((session) => !session.completed).slice(0, 6);
      }

      return recentSessions;
    })();

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      dueTodayOrTomorrow,
      highPriorityOpen,
      mediumPriorityOpen,
      taskCompletionRate,
      totalSessions,
      completedSessions,
      openSessions,
      plannerCompletionRate,
      totalPlannedHours,
      momentumScore,
      consistencyScore,
      cooked,
      bestRecoveryAction,
      moduleStats,
      mostPressuredModule,
      strongestModule,
      coachTitle,
      coachSummary,
      coachAction,
      recentTasks,
      recentSessions,
      filteredTasks,
      filteredSessions,
    };
  }, [tasks, studyPlan, activeFilter]);

  const cookedTone = getScoreTone(analytics.cooked.score);
  const momentumTone = getScoreTone(analytics.momentumScore);
  const consistencyTone = getScoreTone(analytics.consistencyScore);

  function toggleInfoCard(card: "cooked" | "momentum" | "consistency") {
    setOpenInfoCard((current) => (current === card ? null : card));
  }

  function handleFilterClick(filter: ActiveFilter) {
    setActiveFilter((current) => (current === filter ? "all" : filter));
  }

  function getFilterTitle() {
    switch (activeFilter) {
      case "cooked":
        return "Tasks and sessions hurting your Cooked Score most";
      case "momentum":
        return "Work most likely to improve Momentum";
      case "consistency":
        return "Items breaking your Consistency";
      case "overdue":
        return "Overdue tasks";
      case "urgent":
        return "Tasks due today or tomorrow";
      case "highPriority":
        return "High-priority open tasks";
      default:
        return "Recent activity";
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#08122b_0%,#061021_100%)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Performance
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              LockdIn performance dashboard
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Track momentum, consistency, and how cooked you actually are based on
              live deadlines, workload pressure, and planner follow-through.
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

            <button
              type="button"
              onClick={() => handleFilterClick("cooked")}
              className={`rounded-3xl border bg-slate-900 p-6 text-left transition ${
                activeFilter === "cooked"
                  ? "border-blue-500/40 ring-1 ring-blue-500/30"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <p className="text-sm text-slate-400">Cooked Score</p>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-4xl font-bold">{analytics.cooked.score}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${cookedTone.pill}`}>
                  {analytics.cooked.status}
                </span>
              </div>
            </button>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Live cooked pressure</p>
                  <div className="mt-3 flex items-end gap-3">
                    <p className="text-5xl font-bold">{analytics.cooked.score}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${cookedTone.pill}`}
                    >
                      {analytics.cooked.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleFilterClick("cooked")}
                className="mt-5 block w-full text-left"
              >
                <div className="h-3 rounded-full bg-slate-800">
                  <div
                    className={`h-3 rounded-full ${cookedTone.bar} transition-all duration-500`}
                    style={{ width: `${analytics.cooked.score}%` }}
                  />
                </div>
              </button>

              <p className="mt-5 text-sm leading-7 text-slate-300">
                {analytics.cooked.headline}
              </p>

              <div className="mt-6 grid gap-3">
                {analytics.cooked.reasons.map((reason) => (
                  <div
                    key={reason}
                    className="rounded-2xl border border-white/5 bg-slate-950/70 px-4 py-3 text-sm text-slate-300"
                  >
                    {reason}
                  </div>
                ))}
              </div>

              {analytics.bestRecoveryAction && (
                <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                    Best recovery action
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {analytics.bestRecoveryAction.label}
                  </p>
                  <p className="mt-1 text-sm text-emerald-300">
                    Potential score drop: {analytics.bestRecoveryAction.scoreDrop}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <ScoreCard
              title="Cooked Score"
              score={analytics.cooked.score}
              label={analytics.cooked.status}
              accentPillClass={cookedTone.pill}
              barClass={cookedTone.bar}
              isActive={activeFilter === "cooked"}
              onActivate={() => handleFilterClick("cooked")}
              infoOpen={openInfoCard === "cooked"}
              onToggleInfo={() => toggleInfoCard("cooked")}
              infoTitle="How Cooked Score is calculated"
              infoBody="Cooked Score rises when unfinished tasks are overdue, close to today, high priority, or stacking up in volume. It also increases when planned study blocks are being missed. The harsher the deadline pressure and workload pile-up, the higher the score."
              subtitle="Cooked Score shows how much deadline pressure, backlog, and missed study follow-through are building up right now."
              tips={[
                "Finish overdue work first",
                "Clear tasks due today or tomorrow",
                "Reduce your open task pile",
              ]}
            />

            <ScoreCard
              title="Momentum Score"
              score={analytics.momentumScore}
              label={getMomentumLabel(analytics.momentumScore)}
              accentPillClass={momentumTone.pill}
              barClass={momentumTone.bar}
              isActive={activeFilter === "momentum"}
              onActivate={() => handleFilterClick("momentum")}
              infoOpen={openInfoCard === "momentum"}
              onToggleInfo={() => toggleInfoCard("momentum")}
              infoTitle="How Momentum Score is calculated"
              infoBody="Momentum Score is based on task completion, planner completion, low overdue pressure, and keeping high-priority work under control. It measures whether you are actually moving forward, not just planning."
              subtitle="Momentum reflects whether you’re actually moving work forward, not just planning it."
              tips={[
                "Finish one high-priority task",
                "Complete your next study block",
                "Keep overdue tasks at zero",
              ]}
            />

            <ScoreCard
              title="Consistency Score"
              score={analytics.consistencyScore}
              label={getConsistencyLabel(analytics.consistencyScore)}
              accentPillClass={consistencyTone.pill}
              barClass={consistencyTone.bar}
              isActive={activeFilter === "consistency"}
              onActivate={() => handleFilterClick("consistency")}
              infoOpen={openInfoCard === "consistency"}
              onToggleInfo={() => toggleInfoCard("consistency")}
              infoTitle="How Consistency Score is calculated"
              infoBody="Consistency Score starts high and drops when overdue work appears, tasks due today or tomorrow pile up, too many sessions remain incomplete, and your active task workload becomes chaotic. It measures how steady and repeatable your work pattern is."
              subtitle="Consistency drops when urgent work piles up and your planner stops turning into action."
              tips={[
                "Avoid overdue work entirely",
                "Reduce open tasks due today or tomorrow",
                "Complete sessions instead of regenerating the plan",
              ]}
            />
          </section>

          <section className="sticky top-4 z-10 rounded-3xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-400">Focus filter:</span>

              {[
                { key: "all", label: "All" },
                { key: "cooked", label: "Cooked" },
                { key: "momentum", label: "Momentum" },
                { key: "consistency", label: "Consistency" },
                { key: "overdue", label: "Overdue" },
                { key: "urgent", label: "Urgent" },
                { key: "highPriority", label: "High Priority" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveFilter(item.key as ActiveFilter)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeFilter === item.key
                      ? "bg-blue-500 text-white"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_1fr]">
            <button
              type="button"
              onClick={() => handleFilterClick("overdue")}
              className={`rounded-3xl border bg-slate-900 p-6 text-left transition ${
                activeFilter === "overdue"
                  ? "border-blue-500/40 ring-1 ring-blue-500/30"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <p className="text-sm text-slate-400">Overdue tasks</p>
              <p className="mt-3 text-4xl font-bold">{analytics.overdueTasks}</p>
            </button>

            <button
              type="button"
              onClick={() => handleFilterClick("urgent")}
              className={`rounded-3xl border bg-slate-900 p-6 text-left transition ${
                activeFilter === "urgent"
                  ? "border-blue-500/40 ring-1 ring-blue-500/30"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <p className="text-sm text-slate-400">Due today / tomorrow</p>
              <p className="mt-3 text-4xl font-bold">{analytics.dueTodayOrTomorrow}</p>
            </button>

            <button
              type="button"
              onClick={() => handleFilterClick("highPriority")}
              className={`rounded-3xl border bg-slate-900 p-6 text-left transition ${
                activeFilter === "highPriority"
                  ? "border-blue-500/40 ring-1 ring-blue-500/30"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <p className="text-sm text-slate-400">High priority open</p>
              <p className="mt-3 text-4xl font-bold">{analytics.highPriorityOpen}</p>
            </button>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Task Activity</h2>
                  <p className="mt-2 text-sm text-slate-400">{getFilterTitle()}</p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                  {analytics.filteredTasks.length} shown
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {analytics.filteredTasks.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">
                    No matching tasks for this filter.
                  </div>
                ) : (
                  analytics.filteredTasks.map((task) => {
                    const days = getDaysUntil(task.dueDate);

                    return (
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
                            {!task.completed && (
                              <p className="mt-2 text-xs text-slate-500">
                                {days < 0
                                  ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
                                  : days === 0
                                  ? "Due today"
                                  : days === 1
                                  ? "Due tomorrow"
                                  : `Due in ${days} days`}
                              </p>
                            )}
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
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Planner Activity</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {activeFilter === "all"
                      ? "Recent planner activity"
                      : "Planner items connected to the current focus filter"}
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                  {analytics.filteredSessions.length} shown
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {analytics.filteredSessions.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">
                    No matching planner activity for this filter.
                  </div>
                ) : (
                  analytics.filteredSessions.map((session) => (
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
                          <p className="mt-1 text-sm text-slate-500">{session.time}</p>
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
        </div>
      </div>
    </AppShell>
  );
}