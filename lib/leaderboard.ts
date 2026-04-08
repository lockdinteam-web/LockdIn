import { supabase } from "@/lib/supabase";
import {
  calculateCookedScore,
  type StudyBlock,
} from "@/lib/calculateCookedScore";

export type LeaderboardTask = {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
};

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertTodayLeaderboardSnapshot(
  userId: string,
  tasks: LeaderboardTask[],
  studyBlocks: StudyBlock[] = []
) {
  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed).length;
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const cooked = calculateCookedScore(tasks, studyBlocks);

  const { error } = await supabase.from("leaderboard_snapshots").upsert(
    {
      user_id: userId,
      snapshot_date: todayDateString(),
      cooked_score: cooked.score,
      pending_tasks: pendingTasks,
      completed_tasks: completedTasks,
      completion_rate: completionRate,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,snapshot_date",
    }
  );

  if (error) {
    console.error("Error upserting leaderboard snapshot:", error.message);
  }
}

export async function recordActivityDay(userId: string) {
  const { error } = await supabase.from("user_activity_days").upsert(
    {
      user_id: userId,
      activity_date: todayDateString(),
    },
    {
      onConflict: "user_id,activity_date",
    }
  );

  if (error) {
    console.error("Error recording activity day:", error.message);
  }
}