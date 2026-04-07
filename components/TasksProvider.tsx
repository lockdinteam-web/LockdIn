"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const refreshTasks = async () => {
    if (!mountedRef.current || refreshingRef.current) return;

    try {
      refreshingRef.current = true;
      setLoading(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      if (sessionError) {
        console.error("Error getting session:", sessionError.message);
        setTasks([]);
        setLoading(false);
        return;
      }

      const user = session?.user ?? null;

      if (!user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mountedRef.current) return;

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
      if (!mountedRef.current) return;
      setTasks([]);
      setLoading(false);
    } finally {
      refreshingRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    void refreshTasks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      if (!session?.user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      void refreshTasks();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshTasks();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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