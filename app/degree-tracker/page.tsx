"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Layers3,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

type DegreeYear = {
  id: string;
  name: string;
  weight: number | "";
};

type DegreeModule = {
  id: string;
  name: string;
  yearId: string;
  credits: number | "";
  score: number | "";
  completed: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function getClassification(average: number) {
  if (average >= 70) return "First";
  if (average >= 60) return "2:1";
  if (average >= 50) return "2:2";
  if (average >= 40) return "Third";
  return "Fail";
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createDefaultYears(): DegreeYear[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Year 2",
      weight: 30,
    },
    {
      id: crypto.randomUUID(),
      name: "Year 3",
      weight: 70,
    },
  ];
}

function createDefaultModules(yearId: string): DegreeModule[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "",
      yearId,
      credits: "",
      score: "",
      completed: false,
    },
  ];
}

function getClassificationTone(classification: string) {
  switch (classification) {
    case "First":
      return "text-emerald-300";
    case "2:1":
      return "text-blue-300";
    case "2:2":
      return "text-amber-300";
    case "Third":
      return "text-orange-300";
    default:
      return "text-red-300";
  }
}

function getWeightStatus(totalWeight: number) {
  if (totalWeight === 100) {
    return {
      label: "Perfect setup",
      description: "Your year weightings add up to exactly 100%.",
      tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      bar: "bg-emerald-400",
    };
  }

  if (totalWeight < 100) {
    return {
      label: `${formatNumber(100 - totalWeight)}% left to assign`,
      description: "Your weighting is still incomplete.",
      tone: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      bar: "bg-amber-400",
    };
  }

  return {
    label: `${formatNumber(totalWeight - 100)}% over`,
    description: "Your weightings currently exceed 100%.",
    tone: "border-red-500/20 bg-red-500/10 text-red-300",
    bar: "bg-red-400",
  };
}

export default function DegreeTrackerPage() {
  const [years, setYears] = useState<DegreeYear[]>([]);
  const [modules, setModules] = useState<DegreeModule[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const hasLoadedInitialData = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const savedToastTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadTracker = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("degree_trackers")
        .select("years, modules")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Failed to load degree tracker:", error);
        setLoading(false);
        return;
      }

      if (data) {
        const savedYears = Array.isArray(data.years) ? data.years : [];
        const savedModules = Array.isArray(data.modules) ? data.modules : [];

        if (savedYears.length > 0) {
          const safeYears = savedYears as DegreeYear[];
          const validYearIds = new Set(safeYears.map((year) => year.id));

          const safeModules =
            savedModules.length > 0
              ? (savedModules as DegreeModule[]).map((module) => ({
                  ...module,
                  yearId: validYearIds.has(module.yearId)
                    ? module.yearId
                    : safeYears[0].id,
                }))
              : createDefaultModules(safeYears[0].id);

          setYears(safeYears);
          setModules(safeModules);
        } else {
          const defaultYears = createDefaultYears();
          const defaultModules = createDefaultModules(defaultYears[0].id);

          setYears(defaultYears);
          setModules(defaultModules);

          await supabase.from("degree_trackers").upsert(
            {
              user_id: user.id,
              years: defaultYears,
              modules: defaultModules,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        }
      } else {
        const defaultYears = createDefaultYears();
        const defaultModules = createDefaultModules(defaultYears[0].id);

        setYears(defaultYears);
        setModules(defaultModules);

        await supabase.from("degree_trackers").upsert(
          {
            user_id: user.id,
            years: defaultYears,
            modules: defaultModules,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      hasLoadedInitialData.current = true;
      setLoading(false);
    };

    loadTracker();

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (savedToastTimeout.current) clearTimeout(savedToastTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedInitialData.current || !userId) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (savedToastTimeout.current) clearTimeout(savedToastTimeout.current);

    setSaveState("saving");

    saveTimeout.current = setTimeout(async () => {
      const { error } = await supabase.from("degree_trackers").upsert(
        {
          user_id: userId,
          years,
          modules,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Failed to save degree tracker:", error);
        setSaveState("error");
        return;
      }

      setSaveState("saved");

      savedToastTimeout.current = setTimeout(() => {
        setSaveState((current) => (current === "saved" ? "idle" : current));
      }, 1500);
    }, 500);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [years, modules, userId]);

  const addYear = () => {
    const newYear: DegreeYear = {
      id: crypto.randomUUID(),
      name: `Year ${years.length + 1}`,
      weight: "",
    };

    setYears((prev) => [...prev, newYear]);
  };

  const removeYear = (yearId: string) => {
    if (years.length === 1) return;

    const remainingYears = years.filter((year) => year.id !== yearId);
    const fallbackYearId = remainingYears[0]?.id ?? "";

    setYears(remainingYears);
    setModules((prev) =>
      prev
        .filter((module) => module.yearId !== yearId)
        .map((module) => ({
          ...module,
          yearId: remainingYears.some((year) => year.id === module.yearId)
            ? module.yearId
            : fallbackYearId,
        }))
    );
  };

  const updateYear = <K extends keyof DegreeYear>(
    id: string,
    field: K,
    value: DegreeYear[K]
  ) => {
    setYears((prev) =>
      prev.map((year) => (year.id === id ? { ...year, [field]: value } : year))
    );
  };

  const addModule = (preferredYearId?: string) => {
    setModules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        yearId: preferredYearId ?? years[0]?.id ?? "",
        credits: "",
        score: "",
        completed: false,
      },
    ]);
  };

  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((module) => module.id !== id));
  };

  const updateModule = <K extends keyof DegreeModule>(
    id: string,
    field: K,
    value: DegreeModule[K]
  ) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === id ? { ...module, [field]: value } : module
      )
    );
  };

  const resetTracker = () => {
    const defaultYears = createDefaultYears();
    const defaultModules = createDefaultModules(defaultYears[0].id);
    setYears(defaultYears);
    setModules(defaultModules);
  };

  const calculations = useMemo(() => {
    const totalYearWeight = years.reduce((sum, year) => {
      return sum + (typeof year.weight === "number" ? year.weight : 0);
    }, 0);

    const yearBreakdown = years.map((year) => {
      const yearModules = modules.filter((module) => module.yearId === year.id);

      const completedModules = yearModules.filter(
        (module) =>
          module.completed &&
          typeof module.credits === "number" &&
          module.credits > 0 &&
          typeof module.score === "number"
      );

      const incompleteModules = yearModules.filter(
        (module) =>
          !module.completed &&
          typeof module.credits === "number" &&
          module.credits > 0
      );

      const totalCreditsEntered = yearModules.reduce((sum, module) => {
        return sum + (typeof module.credits === "number" ? module.credits : 0);
      }, 0);

      const completedCredits = completedModules.reduce(
        (sum, module) => sum + Number(module.credits),
        0
      );

      const remainingCredits = Math.max(totalCreditsEntered - completedCredits, 0);

      const completedWeightedMarks = completedModules.reduce(
        (sum, module) => sum + Number(module.credits) * Number(module.score),
        0
      );

      const yearAverage =
        completedCredits > 0 ? completedWeightedMarks / completedCredits : 0;

      const yearWeight = typeof year.weight === "number" ? year.weight : 0;
      const contributionSoFar = (yearAverage * yearWeight) / 100;

      return {
        id: year.id,
        name: year.name,
        weight: yearWeight,
        totalCreditsEntered,
        completedCredits,
        remainingCredits,
        completedWeightedMarks,
        yearAverage,
        contributionSoFar,
        moduleCount: yearModules.length,
        completedModuleCount: completedModules.length,
        incompleteModuleCount: incompleteModules.length,
      };
    });

    const weightedAverageSoFar = yearBreakdown.reduce(
      (sum, year) => sum + year.contributionSoFar,
      0
    );

    const maxPossibleAverage = yearBreakdown.reduce((sum, year) => {
      if (year.totalCreditsEntered === 0) return sum;

      const bestPossibleYearAverage =
        (year.completedWeightedMarks + year.remainingCredits * 100) /
        year.totalCreditsEntered;

      return sum + (bestPossibleYearAverage * year.weight) / 100;
    }, 0);

    const totalIncompleteWeightedCredits = modules.reduce((sum, module) => {
      const year = years.find((entry) => entry.id === module.yearId);
      const yearWeight = typeof year?.weight === "number" ? year.weight : 0;
      const credits = typeof module.credits === "number" ? module.credits : 0;

      if (module.completed || credits <= 0 || yearWeight <= 0) return sum;

      return sum + credits * (yearWeight / 100);
    }, 0);

    function estimateRequiredAverageForTarget(target: number) {
      const pointsStillNeeded = target - weightedAverageSoFar;

      if (pointsStillNeeded <= 0) {
        return {
          label: "Already secured",
          exact: null,
        };
      }

      if (totalIncompleteWeightedCredits <= 0) {
        return {
          label: "No remaining credits entered",
          exact: null,
        };
      }

      const requiredAverage = (pointsStillNeeded * 100) / totalIncompleteWeightedCredits;

      if (requiredAverage > 100) {
        return {
          label: "Not achievable with current entered credits",
          exact: requiredAverage,
        };
      }

      return {
        label: `${formatNumber(requiredAverage)}% needed across remaining modules`,
        exact: requiredAverage,
      };
    }

    return {
      totalYearWeight,
      yearBreakdown,
      weightedAverageSoFar,
      currentClassification: getClassification(weightedAverageSoFar),
      maxPossibleAverage,
      bestPossibleClassification: getClassification(maxPossibleAverage),
      targets: {
        first: estimateRequiredAverageForTarget(70),
        upperSecond: estimateRequiredAverageForTarget(60),
        lowerSecond: estimateRequiredAverageForTarget(50),
      },
    };
  }, [years, modules]);

  const weightStatus = getWeightStatus(calculations.totalYearWeight);

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <p className="text-sm text-slate-400">Loading your degree tracker...</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <h1 className="text-2xl font-semibold text-white">Sign in required</h1>
              <p className="mt-2 text-sm text-slate-400">
                Please sign in to save and access your degree tracker.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14),transparent_24%)]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Premium degree planner
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
                  Degree Tracker
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Track your weighted years, module marks, and classification in one
                  clean place. Everything saves automatically to your account.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      saveState === "saving"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        : saveState === "saved"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : saveState === "error"
                        ? "border-red-500/20 bg-red-500/10 text-red-300"
                        : "border-white/10 bg-white/5 text-slate-300"
                    }`}
                  >
                    {saveState === "saving"
                      ? "Saving..."
                      : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                      ? "Save failed"
                      : "Synced"}
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    {years.length} years
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    {modules.length} modules
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[390px]">
                <button
                  onClick={addYear}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Add year
                </button>

                <button
                  onClick={() => addModule()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-3 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20"
                >
                  <BookOpen className="h-4 w-4" />
                  Add module
                </button>

                <button
                  onClick={resetTracker}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset tracker
                </button>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  Account-based saving enabled
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/10 p-2.5 text-blue-300">
                  <Target className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Current weighted average</p>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-white">
                {formatNumber(calculations.weightedAverageSoFar)}%
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-300">
                  <Award className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Current classification</p>
              </div>
              <p
                className={`mt-4 text-3xl font-bold tracking-tight ${getClassificationTone(
                  calculations.currentClassification
                )}`}
              >
                {calculations.currentClassification}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-purple-500/10 p-2.5 text-purple-300">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Best possible average</p>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-white">
                {formatNumber(calculations.maxPossibleAverage)}%
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-400">Best possible outcome</p>
              </div>
              <p
                className={`mt-4 text-3xl font-bold tracking-tight ${getClassificationTone(
                  calculations.bestPossibleClassification
                )}`}
              >
                {calculations.bestPossibleClassification}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1.35fr]">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Scale className="h-5 w-5 text-blue-300" />
                      <h2 className="text-xl font-semibold text-white">
                        Year weightings
                      </h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Set how much each year contributes to your final degree.
                    </p>
                  </div>

                  <button
                    onClick={addYear}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                  >
                    <Plus className="h-4 w-4" />
                    Add year
                  </button>
                </div>

                <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {weightStatus.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {weightStatus.description}
                      </p>
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${weightStatus.tone}`}
                    >
                      {formatNumber(calculations.totalYearWeight)}%
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${weightStatus.bar} transition-all duration-300`}
                      style={{
                        width: `${clamp(calculations.totalYearWeight, 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {years.map((year, index) => (
                    <div
                      key={year.id}
                      className="rounded-[24px] border border-white/10 bg-slate-950/50 p-4"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Year {index + 1}
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-300">
                            Set the year label and weighting
                          </p>
                        </div>

                        {years.length > 1 && (
                          <button
                            onClick={() => removeYear(year.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm text-slate-400">
                            Year name
                          </label>
                          <input
                            type="text"
                            value={year.name}
                            onChange={(e) =>
                              updateYear(year.id, "name", e.target.value)
                            }
                            placeholder="e.g. Year 2"
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-400">
                            Weighting %
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={year.weight}
                            onChange={(e) =>
                              updateYear(
                                year.id,
                                "weight",
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            placeholder="e.g. 70"
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => addModule(year.id)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                        Add module to {year.name || `Year ${index + 1}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-purple-300" />
                      <h2 className="text-xl font-semibold text-white">Modules</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Add modules, assign them to a year, and tick them once your final mark is in.
                    </p>
                  </div>

                  <button
                    onClick={() => addModule()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20"
                  >
                    <Plus className="h-4 w-4" />
                    Add module
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {modules.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-950/30 p-6 text-center">
                      <p className="text-sm text-slate-400">
                        No modules yet. Add one to start calculating your degree.
                      </p>
                    </div>
                  ) : (
                    modules.map((module, index) => (
                      <div
                        key={module.id}
                        className="rounded-[24px] border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Module {index + 1}
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-300">
                              Enter the module details below
                            </p>
                          </div>

                          {modules.length > 1 && (
                            <button
                              onClick={() => removeModule(module.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/15"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm text-slate-400">
                              Module name
                            </label>
                            <input
                              type="text"
                              value={module.name}
                              onChange={(e) =>
                                updateModule(module.id, "name", e.target.value)
                              }
                              placeholder="e.g. Software Engineering"
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-slate-400">
                              Year
                            </label>
                            <select
                              value={module.yearId}
                              onChange={(e) =>
                                updateModule(module.id, "yearId", e.target.value)
                              }
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                            >
                              {years.map((year) => (
                                <option key={year.id} value={year.id}>
                                  {year.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-slate-400">
                              Credits
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={module.credits}
                              onChange={(e) =>
                                updateModule(
                                  module.id,
                                  "credits",
                                  e.target.value === "" ? "" : Number(e.target.value)
                                )
                              }
                              placeholder="20"
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-slate-400">
                              Score %
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={module.score}
                              onChange={(e) =>
                                updateModule(
                                  module.id,
                                  "score",
                                  e.target.value === "" ? "" : Number(e.target.value)
                                )
                              }
                              placeholder="67"
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                              <input
                                type="checkbox"
                                checked={module.completed}
                                onChange={(e) =>
                                  updateModule(module.id, "completed", e.target.checked)
                                }
                                className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                              />
                              Final score received for this module
                            </label>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-xl font-semibold text-white">Year breakdown</h2>
                </div>

                <div className="mt-5 space-y-4">
                  {calculations.yearBreakdown.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-950/30 p-6 text-center">
                      <p className="text-sm text-slate-400">
                        Add years to see a breakdown.
                      </p>
                    </div>
                  ) : (
                    calculations.yearBreakdown.map((year) => {
                      const progress =
                        year.totalCreditsEntered > 0
                          ? (year.completedCredits / year.totalCreditsEntered) * 100
                          : 0;

                      return (
                        <div
                          key={year.id}
                          className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/50"
                        >
                          <div className="border-b border-white/10 px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold text-white">
                                  {year.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-400">
                                  {year.completedModuleCount} completed ·{" "}
                                  {year.incompleteModuleCount} remaining
                                </p>
                              </div>

                              <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
                                {formatNumber(year.weight)}%
                              </div>
                            </div>
                          </div>

                          <div className="p-5">
                            <div className="mb-4">
                              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                                <span>Progress through entered credits</span>
                                <span>{formatNumber(progress)}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                                  style={{ width: `${clamp(progress, 0, 100)}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                  Year average
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                  {formatNumber(year.yearAverage)}%
                                </p>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                  Degree contribution
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                  {formatNumber(year.contributionSoFar)}%
                                </p>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                  Credits entered
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                  {year.totalCreditsEntered}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                  Remaining credits
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                  {year.remainingCredits}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-xl font-semibold text-white">Target insights</h2>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-emerald-200">First</p>
                      <p className="text-sm font-bold text-emerald-300">70%</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                      {calculations.targets.first.label}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-blue-200">2:1</p>
                      <p className="text-sm font-bold text-blue-300">60%</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-blue-100/80">
                      {calculations.targets.upperSecond.label}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-200">2:2</p>
                      <p className="text-sm font-bold text-amber-300">50%</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-amber-100/80">
                      {calculations.targets.lowerSecond.label}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-xl font-semibold text-white">How it works</h2>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-sm font-medium text-white">
                      1. Set year weightings
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Example: Year 2 = 30%, Year 3 = 70%.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-sm font-medium text-white">
                      2. Add modules and credits
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Modules inside each year are averaged using their credits.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-sm font-medium text-white">
                      3. Tick modules when final
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Only completed modules count toward your current live average.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-sm font-medium text-blue-200">
                      Your progress is saved to your account
                    </p>
                    <p className="mt-1 text-sm leading-6 text-blue-100/80">
                      So it stays there when you log out, switch browser, or come back later.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-slate-900 p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Quick tip</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      Get your weighting to exactly 100% for the cleanest prediction.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Once your year weights and credits are accurate, this becomes a
                      really strong live estimate of your degree outcome.
                    </p>
                  </div>

                  <ChevronRight className="mt-1 h-5 w-5 text-slate-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}