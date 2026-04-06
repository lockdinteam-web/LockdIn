"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";

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

const YEARS_STORAGE_KEY = "lockdin_degree_tracker_years";
const MODULES_STORAGE_KEY = "lockdin_degree_tracker_modules_v2";

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

export default function DegreeTrackerPage() {
  const [years, setYears] = useState<DegreeYear[]>([]);
  const [modules, setModules] = useState<DegreeModule[]>([]);

  useEffect(() => {
    const savedYears = localStorage.getItem(YEARS_STORAGE_KEY);
    const savedModules = localStorage.getItem(MODULES_STORAGE_KEY);

    if (savedYears) {
      const parsedYears: DegreeYear[] = JSON.parse(savedYears);
      setYears(parsedYears);

      if (savedModules) {
        setModules(JSON.parse(savedModules));
      } else {
        setModules([
          {
            id: crypto.randomUUID(),
            name: "",
            yearId: parsedYears[0]?.id ?? "",
            credits: "",
            score: "",
            completed: false,
          },
        ]);
      }
    } else {
      const defaultYears = createDefaultYears();
      setYears(defaultYears);
      setModules([
        {
          id: crypto.randomUUID(),
          name: "",
          yearId: defaultYears[0].id,
          credits: "",
          score: "",
          completed: false,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (years.length > 0) {
      localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(years));
    }
  }, [years]);

  useEffect(() => {
    localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(modules));
  }, [modules]);

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
          yearId: module.yearId || fallbackYearId,
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

  const addModule = () => {
    setModules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        yearId: years[0]?.id ?? "",
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

      const totalCreditsEntered = yearModules.reduce((sum, module) => {
        return sum + (typeof module.credits === "number" ? module.credits : 0);
      }, 0);

      const completedCredits = completedModules.reduce(
        (sum, module) => sum + Number(module.credits),
        0
      );

      const completedWeightedMarks = completedModules.reduce(
        (sum, module) => sum + Number(module.credits) * Number(module.score),
        0
      );

      const yearAverage =
        completedCredits > 0 ? completedWeightedMarks / completedCredits : 0;

      const yearWeight = typeof year.weight === "number" ? year.weight : 0;
      const contributionSoFar = (yearAverage * yearWeight) / 100;
      const remainingCredits = Math.max(totalCreditsEntered - completedCredits, 0);

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

    return {
      totalYearWeight,
      yearBreakdown,
      weightedAverageSoFar,
      currentClassification: getClassification(weightedAverageSoFar),
      maxPossibleAverage,
      bestPossibleClassification: getClassification(maxPossibleAverage),
    };
  }, [years, modules]);

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Degree Tracker
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">
              Add your years, set each year’s weighting, then enter module scores
              to see your weighted degree average and what you need for a First,
              2:1, 2:2, or Third.
            </p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Current weighted average</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(calculations.weightedAverageSoFar)}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Current classification</p>
              <p className="mt-2 text-3xl font-bold">
                {calculations.currentClassification}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Best possible average</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(calculations.maxPossibleAverage)}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Best possible outcome</p>
              <p className="mt-2 text-3xl font-bold">
                {calculations.bestPossibleClassification}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1.3fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Year weightings</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Example: Year 2 = 30%, Year 3 = 70%.
                    </p>
                  </div>

                  <button
                    onClick={addYear}
                    className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/15"
                  >
                    + Add year
                  </button>
                </div>

                <div className="space-y-4">
                  {years.map((year, index) => (
                    <div
                      key={year.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-300">
                          Year setup {index + 1}
                        </p>

                        {years.length > 1 && (
                          <button
                            onClick={() => removeYear(year.id)}
                            className="text-sm text-red-400 transition hover:text-red-300"
                          >
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-400">
                            Degree weighting %
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Total weighting entered</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {formatNumber(calculations.totalYearWeight)}%
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    For the cleanest calculation, this should add up to 100%.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Modules</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Assign each module to a year and tick it once the final mark is in.
                    </p>
                  </div>

                  <button
                    onClick={addModule}
                    className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/15"
                  >
                    + Add module
                  </button>
                </div>

                <div className="space-y-4">
                  {modules.map((module, index) => (
                    <div
                      key={module.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-300">
                          Module {index + 1}
                        </p>

                        {modules.length > 1 && (
                          <button
                            onClick={() => removeModule(module.id)}
                            className="text-sm text-red-400 transition hover:text-red-300"
                          >
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
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
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                          />
                        </div>
                      </div>

                      <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
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
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-xl font-semibold">Year breakdown</h2>

                <div className="mt-4 space-y-4">
                  {calculations.yearBreakdown.map((year) => (
                    <div
                      key={year.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-lg font-semibold text-white">
                          {year.name}
                        </p>
                        <p className="text-sm text-blue-300">
                          {formatNumber(year.weight)}% weighting
                        </p>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-slate-400">Year average</p>
                          <p className="mt-1 text-2xl font-bold text-white">
                            {formatNumber(year.yearAverage)}%
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400">
                            Contribution to degree so far
                          </p>
                          <p className="mt-1 text-2xl font-bold text-white">
                            {formatNumber(year.contributionSoFar)}%
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400">Credits entered</p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {year.totalCreditsEntered}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400">Remaining credits</p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {year.remainingCredits}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-xl font-semibold">Important note</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  This version calculates your degree using custom year weightings.
                  Inside each year, module averages are credit-weighted. Then each
                  year average is multiplied by its degree weighting. For best
                  results, make sure your year weightings add up to 100%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}