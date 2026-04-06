"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Priority = "High" | "Medium" | "Low";

type Task = {
  id: string;
  title: string;
  module: string;
  due_date: string;
  priority: Priority;
  completed: boolean;
  user_id: string;
};

type TasksContextType = {
  tasks: Task[];
  loading: boolean;
  refreshTasks: () => Promise<void>;
};

const TasksContext = createContext<TasksContextType>({
  tasks: [],
  loading: true,
  refreshTasks: async () => {},
});

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshTasks = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error.message);
        setTasks([]);
        setLoading(false);
        return;
      }

      setTasks((data as Task[]) ?? []);
      setLoading(false);
    } catch (error) {
      console.error("Unexpected provider error:", error);
      setTasks([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTasks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshTasks();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <TasksContext.Provider value={{ tasks, loading, refreshTasks }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  return useContext(TasksContext);
}