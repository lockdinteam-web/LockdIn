import { supabase } from "@/lib/supabase";

export type DegreeYear = {
  id: string;
  name: string;
  weight: number | "";
};

export type DegreeModule = {
  id: string;
  name: string;
  yearId: string;
  credits: number | "";
  score: number | "";
  completed: boolean;
};

export async function getDegreeTracker(userId: string) {
  const { data, error } = await supabase
    .from("degree_trackers")
    .select("years, modules")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data ?? null;
}

export async function saveDegreeTracker(
  userId: string,
  years: DegreeYear[],
  modules: DegreeModule[]
) {
  const { error } = await supabase.from("degree_trackers").upsert(
    {
      user_id: userId,
      years,
      modules,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}