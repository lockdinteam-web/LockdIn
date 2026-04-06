export type Priority = "High" | "Medium" | "Low";

export type Task = {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

export type StudyBlock = {
  id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  taskId: string;
  durationMinutes: number;
  completed: boolean;
};

export type CookedResult = {
  score: number;
  status: string;
  headline: string;
  reasons: string[];
};

export type RecoveryAction = {
  type: "task" | "studyBlock";
  id: string;
  label: string;
  scoreDrop: number;
  route: string;
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysUntil(dateString: string) {
  const today = startOfToday();
  const due = new Date(dateString);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function priorityWeight(priority: Priority) {
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
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

  if (days < 0) return 12 * weight;      // overdue
  if (days === 0) return 10 * weight;    // due today
  if (days === 1) return 8 * weight;     // due tomorrow
  if (days <= 3) return 6 * weight;      // next 3 days
  if (days <= 7) return 4 * weight;      // this week
  if (days <= 14) return 2 * weight;     // next 2 weeks
  return 1 * weight;                     // still counts a bit
}

export function calculateCookedScore(
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

  const overdueTasks = incompleteTasks.filter((task) => daysUntil(task.dueDate) < 0);

  const dueSoonTasks = incompleteTasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return days >= 0 && days <= 7;
  });

  const highPriorityOpen = incompleteTasks.filter(
    (task) => task.priority === "High"
  ).length;

  const mediumPriorityOpen = incompleteTasks.filter(
    (task) => task.priority === "Medium"
  ).length;

  const missedBlocks = studyBlocks.filter((block) => !block.completed);

  // 1) Overdue tasks: harsher than before
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

  // 2) Deadline pressure: much harsher for tasks close to today
  deadlinePressureScore = Math.min(
    30,
    incompleteTasks.reduce((sum, task) => {
      const days = daysUntil(task.dueDate);
      return sum + getDeadlineUrgencyScore(days, task.priority);
    }, 0)
  );

  if (dueSoonTasks.length > 0) {
    reasons.push(
      `${dueSoonTasks.length} deadline${dueSoonTasks.length === 1 ? "" : "s"} in the next 7 days`
    );
  }

  // 3) Priority pressure
  priorityScore = Math.min(15, highPriorityOpen * 4 + mediumPriorityOpen * 2);

  if (highPriorityOpen > 0) {
    reasons.push(
      `${highPriorityOpen} high-priority task${highPriorityOpen === 1 ? "" : "s"} still open`
    );
  }

  // 4) Workload pressure: scales up harder as unfinished tasks increase
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

  // 5) Missed study blocks
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

export function getBestRecoveryAction(
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