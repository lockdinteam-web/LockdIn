import { XP_VALUES } from "./constants";
import type { TaskLike, StudyBlockLike } from "./types";

export function getTaskXp(task: TaskLike) {
  const base =
    task.priority === "High"
      ? XP_VALUES.TASK_HIGH
      : task.priority === "Medium"
      ? XP_VALUES.TASK_MEDIUM
      : XP_VALUES.TASK_LOW;

  const today = new Date();
  const due = new Date(task.dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const earlyBonus = due.getTime() > today.getTime() ? XP_VALUES.EARLY_BONUS : 0;

  return base + earlyBonus;
}

export function getStudyBlockXp(block: StudyBlockLike) {
  if (block.duration_minutes >= 90) return XP_VALUES.STUDY_BLOCK_90;
  if (block.duration_minutes >= 60) return XP_VALUES.STUDY_BLOCK_60;
  return XP_VALUES.STUDY_BLOCK_30;
}

export function getBossDamageFromTask(task: TaskLike) {
  if (task.priority === "High") return 35;
  if (task.priority === "Medium") return 25;
  return 15;
}