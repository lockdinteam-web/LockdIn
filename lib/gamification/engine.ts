import { DEFAULT_GAME_STATE } from "./constants";
import { getLevelFromXp } from "./levels";
import { generateRecoveryMission, isMissionComplete } from "./missions";
import { createShareMoment } from "./share";
import { getBossDamageFromTask, getStudyBlockXp, getTaskXp } from "./scoring";
import { updateStreak } from "./streaks";
import { updateLeagueForWeek } from "./weekly";
import type {
  BossBattle,
  GamificationState,
  RecoveryMission,
  StudyBlockLike,
  TaskLike,
  XPEvent,
} from "./types";

function addXpEvent(
  state: GamificationState,
  event: XPEvent
): GamificationState {
  return {
    ...state,
    recentXpEvents: [event, ...state.recentXpEvents].slice(0, 20),
  };
}

function awardXp(
  state: GamificationState,
  value: number,
  label: string,
  type: XPEvent["type"]
): GamificationState {
  const nextXp = state.stats.xp + value;
  const nextWeeklyXp = state.stats.weeklyXp + value;

  const updated: GamificationState = {
    ...state,
    stats: {
      ...state.stats,
      xp: nextXp,
      weeklyXp: nextWeeklyXp,
      level: getLevelFromXp(nextXp),
    },
    league: updateLeagueForWeek(state.league, nextWeeklyXp),
  };

  return addXpEvent(updated, {
    id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    value,
    createdAt: new Date().toISOString(),
    label,
  });
}

export function getInitialGamificationState(): GamificationState {
  return DEFAULT_GAME_STATE;
}

export function createBossesFromTasks(tasks: TaskLike[]): BossBattle[] {
  return tasks
    .filter((task) => !task.completed)
    .map((task) => ({
      id: `boss-${task.id}`,
      title: task.title,
      taskId: task.id,
      maxHp: 100,
      currentHp: 100,
      dueDate: task.dueDate,
      module: task.module,
      isComplete: false,
    }));
}

export function completeTaskInGame(
  state: GamificationState,
  task: TaskLike,
  cookedScore: number,
  allTasks: TaskLike[]
): GamificationState {
  let next = { ...state };

  const xp = getTaskXp(task);
  next = awardXp(next, xp, `Completed ${task.title}`, "task_complete");

  next.stats = updateStreak({
    ...next.stats,
    totalCompletedTasks: next.stats.totalCompletedTasks + 1,
  });

  next.bosses = next.bosses.map((boss) => {
    if (boss.taskId !== task.id) return boss;

    const damage = getBossDamageFromTask(task);
    const currentHp = Math.max(0, boss.currentHp - damage);
    const isComplete = currentHp === 0 || task.completed;

    return {
      ...boss,
      currentHp,
      isComplete,
    };
  });

  const defeatedBoss = next.bosses.find(
    (boss) => boss.taskId === task.id && boss.isComplete
  );

  if (defeatedBoss) {
    next.lastShareMoment = createShareMoment({
      type: "boss_defeated",
      title: "Boss Defeated",
      subtitle: `${task.title} has been cleared.`,
      score: cookedScore,
      xp: next.stats.xp,
      streakDays: next.stats.streakDays,
    });
  }

  if (next.missions.length === 0) {
    const mission = generateRecoveryMission(allTasks, cookedScore);
    if (mission) {
      next.missions = [mission];
    }
  }

  next.missions = next.missions.map((mission) => {
    const updatedGoals = mission.goals.map((goal) => {
      if (goal.type === "complete_task") {
        return { ...goal, current: goal.current + 1 };
      }

      if (goal.type === "complete_overdue_task") {
        const today = new Date();
        const due = new Date(task.dueDate);
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        if (due.getTime() < today.getTime()) {
          return { ...goal, current: goal.current + 1 };
        }
      }

      return goal;
    });

    const updatedMission: RecoveryMission = {
      ...mission,
      goals: updatedGoals,
      status: isMissionComplete({ ...mission, goals: updatedGoals })
        ? "completed"
        : "active",
    };

    return updatedMission;
  });

  const completedMission = next.missions.find(
    (mission) => mission.status === "completed"
  );

  if (completedMission) {
    next = awardXp(
      next,
      completedMission.rewardXp,
      completedMission.title,
      "recovery_mission_complete"
    );
  }

  return next;
}

export function completeStudyBlockInGame(
  state: GamificationState,
  block: StudyBlockLike
): GamificationState {
  let next = { ...state };

  const xp = getStudyBlockXp(block);
  next = awardXp(
    next,
    xp,
    `Completed ${block.subject} study block`,
    "study_block_complete"
  );

  next.stats = updateStreak({
    ...next.stats,
    totalCompletedStudyBlocks: next.stats.totalCompletedStudyBlocks + 1,
  });

  next.missions = next.missions.map((mission) => {
    const updatedGoals = mission.goals.map((goal) => {
      if (goal.type === "complete_study_minutes") {
        return {
          ...goal,
          current: Math.min(goal.target, goal.current + block.duration_minutes),
        };
      }

      return goal;
    });

    return {
      ...mission,
      goals: updatedGoals,
      status: isMissionComplete({ ...mission, goals: updatedGoals })
        ? "completed"
        : "active",
    };
  });

  return next;
}