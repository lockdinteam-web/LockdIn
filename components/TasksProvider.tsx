"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getTasksForUser, type Task } from "@/lib/tasks";

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
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const userTasks = await getTasksForUser(session.user.id);
    setTasks(userTasks);
    setLoading(false);
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