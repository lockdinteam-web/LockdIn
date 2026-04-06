import { supabase } from "@/lib/supabase";

export type Priority = "High" | "Medium" | "Low";

export type Task = {
  id: string;
  title: string;
  module: string;
  due_date: string;
  priority: Priority;
  completed: boolean;
  user_id: string;
};

export async function getTasksForUser(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return data ?? [];
}