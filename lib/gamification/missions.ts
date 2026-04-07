import { XP_VALUES } from "./constants";
import type { RecoveryMission, TaskLike } from "./types";

export function generateRecoveryMission(
  tasks: TaskLike[],
  cookedScore: number
): RecoveryMission | null {
  const overdue = tasks.filter((task) => {
    if (task.completed) return false;

    const today = new Date();
    const due = new Date(task.dueDate);

    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    return due.getTime() < today.getTime();
  });

  if (cookedScore < 55 && overdue.length > 0) {
    return {
      id: `mission-${Date.now()}`,
      title: "Clutch Recovery Mission",
      description: "Clear overdue work and stabilise your score.",
      rewardXp: XP_VALUES.RECOVERY_MISSION,
      status: "active",
      goals: [
        {
          type: "complete_overdue_task",
          target: Math.min(2, overdue.length),
          current: 0,
        },
        {
          type: "complete_study_minutes",
          target: 45,
          current: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

export function isMissionComplete(mission: RecoveryMission) {
  return mission.goals.every((goal) => goal.current >= goal.target);
}