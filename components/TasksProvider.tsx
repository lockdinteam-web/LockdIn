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
  const [sessionChecked, setSessionChecked] = useState(false);
  const mountedRef = useRef(true);

  const refreshTasks = async () => {
    try {
      if (!mountedRef.current) return;

      setLoading(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Error getting session:", sessionError.message);
        if (!mountedRef.current) return;
        setTasks([]);
        setLoading(false);
        setSessionChecked(true);
        return;
      }

      const user = session?.user ?? null;

      if (!user) {
        if (!mountedRef.current) return;
        setTasks([]);
        setLoading(false);
        setSessionChecked(true);
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
        setSessionChecked(true);
        return;
      }

      setTasks((data as Task[]) ?? []);
      setLoading(false);
      setSessionChecked(true);
    } catch (error) {
      console.error("Unexpected provider error:", error);
      if (!mountedRef.current) return;
      setTasks([]);
      setLoading(false);
      setSessionChecked(true);
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
        setSessionChecked(true);
        return;
      }

      void refreshTasks();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && sessionChecked) {
        void refreshTasks();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionChecked]);

  return (
    <TasksContext.Provider value={{ tasks, loading, refreshTasks }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  return useContext(TasksContext);
}