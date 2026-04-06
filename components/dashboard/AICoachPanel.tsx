type CoachInput = {
  urgentTasks: number;
  weeklyCompletion: number;
  studyStreak: number;
  plannedTasksToday?: number;
  completedTasksToday?: number;
};

type CoachOutput = {
  title: string;
  summary: string;
  priority: string;
  actions: string[];
  tone: "good" | "warning" | "focus";
};

function getCoachInsight(data: CoachInput): CoachOutput {
  const planned = data.plannedTasksToday ?? 0;
  const completed = data.completedTasksToday ?? 0;

  if (data.urgentTasks >= 4) {
    return {
      title: "Your top priority is urgent work",
      summary:
        "You have several urgent tasks stacking up. Focus on reducing pressure before adding anything new.",
      priority: "Clear your most urgent task first.",
      actions: [
        "Finish the highest-deadline task first",
        "Avoid starting low-impact work today",
        "Use planner blocks for urgent subjects only",
      ],
      tone: "warning",
    };
  }

  if (data.weeklyCompletion < 50) {
    return {
      title: "Your consistency needs attention",
      summary:
        "You are active, but weekly completion is still low. The biggest gain now is follow-through.",
      priority: "Complete what you already planned.",
      actions: [
        "Finish 2 existing tasks before adding new ones",
        "Review today’s planner and remove non-essential items",
        "Aim for completion, not perfect planning",
      ],
      tone: "focus",
    };
  }

  if (data.studyStreak >= 5 && data.weeklyCompletion >= 70) {
    return {
      title: "You’re building strong momentum",
      summary:
        "Your recent consistency is working. Stay steady and protect the routine you’ve built.",
      priority: "Maintain momentum without overloading yourself.",
      actions: [
        "Keep today’s workload realistic",
        "Protect your study streak with one guaranteed win",
        "Use spare energy on your weakest module",
      ],
      tone: "good",
    };
  }

  if (planned > 0 && completed < planned / 2) {
    return {
      title: "Execution is more important than planning today",
      summary:
        "You already have enough structure. What matters now is acting on the plan you made.",
      priority: "Finish the next planned task before reorganising anything.",
      actions: [
        "Open the next task and complete one focused block",
        "Do not rebuild your planner again today",
        "Use momentum, not motivation, to move forward",
      ],
      tone: "focus",
    };
  }

  return {
    title: "You’re in a stable position",
    summary:
      "Nothing major is off track right now. Keep your workload balanced and move forward steadily.",
    priority: "Stay consistent and finish today’s key work.",
    actions: [
      "Complete your next scheduled task",
      "Keep urgent work visible",
      "Use the planner to stay realistic, not overloaded",
    ],
    tone: "good",
  };
}

function toneClasses(tone: CoachOutput["tone"]) {
  switch (tone) {
    case "warning":
      return {
        badge: "bg-rose-500/15 text-rose-300 border border-rose-400/20",
        panel: "border border-white/10 bg-white/5",
      };
    case "focus":
      return {
        badge: "bg-amber-500/15 text-amber-300 border border-amber-400/20",
        panel: "border border-white/10 bg-white/5",
      };
    default:
      return {
        badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
        panel: "border border-white/10 bg-white/5",
      };
  }
}

export default function AICoachPanel() {
  const data: CoachInput = {
    urgentTasks: 4,
    weeklyCompletion: 72,
    studyStreak: 6,
    plannedTasksToday: 4,
    completedTasksToday: 2,
  };

  const coach = getCoachInsight(data);
  const styles = toneClasses(coach.tone);

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#08122b] p-6 text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles.badge}`}>
            AI Coach
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">{coach.title}</h2>
          <p className="mt-3 text-base leading-7 text-slate-300">{coach.summary}</p>
        </div>

        <div className={`min-w-[220px] rounded-2xl p-4 ${styles.panel}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Priority</p>
          <p className="mt-2 text-sm font-medium text-white">{coach.priority}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {coach.actions.map((action) => (
          <div
            key={action}
            className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200"
          >
            {action}
          </div>
        ))}
      </div>
    </section>
  );
}