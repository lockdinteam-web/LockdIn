"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type StudyBlock = {
  id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  task_id?: string | null;
  duration_minutes: number;
  completed: boolean;
  user_id: string;
};

type StudyPlanContextType = {
  studyBlocks: StudyBlock[];
  loading: boolean;
  refreshStudyBlocks: () => Promise<void>;
};

const StudyPlanContext = createContext<StudyPlanContextType>({
  studyBlocks: [],
  loading: true,
  refreshStudyBlocks: async () => {},
});

export function StudyPlanProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshStudyBlocks = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStudyBlocks([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("study_blocks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching study blocks:", error.message);
        setStudyBlocks([]);
        setLoading(false);
        return;
      }

      setStudyBlocks((data as StudyBlock[]) ?? []);
      setLoading(false);
    } catch (error) {
      console.error("Unexpected study plan provider error:", error);
      setStudyBlocks([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStudyBlocks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshStudyBlocks();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <StudyPlanContext.Provider
      value={{ studyBlocks, loading, refreshStudyBlocks }}
    >
      {children}
    </StudyPlanContext.Provider>
  );
}

export function useStudyPlan() {
  return useContext(StudyPlanContext);
}