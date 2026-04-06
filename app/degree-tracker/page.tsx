"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";

type DegreeModule = {
  id: string;
  name: string;
  credits: number | "";
  score: number | "";
  completed: boolean;
};

const STORAGE_KEY = "lockdin_degree_tracker_modules";
const DEFAULT_TOTAL_CREDITS = 120;

function getClassification(average: number) {
  if (average >= 70) return "First";
  if (average >= 60) return "2:1";
  if (average >= 50) return "2:2";
  if (average >= 40) return "Third";
  return "Fail";
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function getNeededAverage(
  targetAverage: number,
  totalCredits: number,
  completedWeightedScore: number,
  remainingCredits: number
) {
  if (remainingCredits <= 0) return null;
  return (
    (targetAverage * totalCredits - completedWeightedScore) / remainingCredits
  );
}

export default function DegreeTrackerPage() {
  const [modules, setModules] = useState<DegreeModule[]>([]);
  const [totalCredits, setTotalCredits] = useState<number>(DEFAULT_TOTAL_CREDITS);

  useEffect(() => {
    const savedModules = localStorage.getItem(STORAGE_KEY);
    if (savedModules) {
      setModules(JSON.parse(savedModules));
    } else {
      setModules([
        {
          id: crypto.randomUUID(),
          name: "",
          credits: "",
          score: "",
          completed: false,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
  }, [modules]);

  const addModule = () => {
    setModules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
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
    const completedModules = modules.filter(
      (module) =>
        module.completed &&
        typeof module.credits === "number" &&
        typeof module.score === "number"
    );

    const enteredModules = modules.filter(
      (module) => typeof module.credits === "number" && module.credits > 0
    );

    const completedCredits = completedModules.reduce(
      (sum, module) => sum + Number(module.credits),
      0
    );

    const completedWeightedScore = completedModules.reduce(
      (sum, module) => sum + Number(module.credits) * Number(module.score),
      0
    );

    const plannedCredits = enteredModules.reduce(
      (sum, module) => sum + Number(module.credits),
      0
    );

    const remainingCredits = Math.max(totalCredits - completedCredits, 0);

    const currentAverage =
      completedCredits > 0 ? completedWeightedScore / completedCredits : 0;

    const firstNeeded = getNeededAverage(
      70,
      totalCredits,
      completedWeightedScore,
      remainingCredits
    );
    const twoOneNeeded = getNeededAverage(
      60,
      totalCredits,
      completedWeightedScore,
      remainingCredits
    );
    const twoTwoNeeded = getNeededAverage(
      50,
      totalCredits,
      completedWeightedScore,
      remainingCredits
    );
    const thirdNeeded = getNeededAverage(
      40,
      totalCredits,
      completedWeightedScore,
      remainingCredits
    );

    let bestPossible = "Fail";

    if (remainingCredits === 0) {
      bestPossible = getClassification(currentAverage);
    } else {
      const maxPossibleAverage =
        (completedWeightedScore + remainingCredits * 100) / totalCredits;
      bestPossible = getClassification(maxPossibleAverage);
    }

    return {
      completedCredits,
      completedWeightedScore,
      plannedCredits,
      remainingCredits,
      currentAverage,
      currentClassification: getClassification(currentAverage),
      bestPossible,
      firstNeeded,
      twoOneNeeded,
      twoTwoNeeded,
      thirdNeeded,
    };
  }, [modules, totalCredits]);

  const getTargetMessage = (needed: number | null, label: string) => {
    if (needed === null) {
      return `No remaining credits left for ${label}.`;
    }

    if (needed <= 0) {
      return `You have already secured ${label}.`;
    }

    if (needed > 100) {
      return `${label} is no longer mathematically possible.`;
    }

    if (needed > 85) {
      return `${label} is still possible, but it will require an exceptional finish.`;
    }

    if (needed > 70) {
      return `${label} is possible, but you need a very strong finish.`;
    }

    if (needed > 60) {
      return `${label} is within reach if you perform strongly in the remaining modules.`;
    }

    return `${label} looks achievable based on your current position.`;
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Degree Tracker
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">
              Enter your completed module scores to see your current weighted
              average, estimated classification, and what you need in your
              remaining credits to reach each degree boundary.
            </p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Current weighted average</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(calculations.currentAverage)}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Current classification</p>
              <p className="mt-2 text-3xl font-bold">
                {calculations.currentClassification}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Completed credits</p>
              <p className="mt-2 text-3xl font-bold">
                {calculations.completedCredits}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">Remaining credits</p>
              <p className="mt-2 text-3xl font-bold">
                {calculations.remainingCredits}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Your modules</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Tick a module once you have the final mark.
                  </p>
                </div>

                <button
                  onClick={addModule}
                  className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/15"
                >
                  + Add module
                </button>
              </div>

              <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <label className="mb-2 block text-sm text-slate-400">
                  Total course credits
                </label>
                <input
                  type="number"
                  min={1}
                  value={totalCredits}
                  onChange={(e) => setTotalCredits(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                />
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

                    <div className="grid gap-4 md:grid-cols-4">
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
                          placeholder="e.g. Data Structures"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
                        />
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

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-xl font-semibold">Position summary</h2>

                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                    <p className="text-sm text-slate-400">Planned credits entered</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      {calculations.plannedCredits}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                    <p className="text-sm text-slate-400">Best possible outcome</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      {calculations.bestPossible}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                    <p className="text-sm text-slate-400">What this means</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      You are currently on a{" "}
                      <span className="font-semibold text-white">
                        {formatNumber(calculations.currentAverage)}%
                      </span>{" "}
                      average, which puts you at a{" "}
                      <span className="font-semibold text-white">
                        {calculations.currentClassification}
                      </span>
                      . With your remaining{" "}
                      <span className="font-semibold text-white">
                        {calculations.remainingCredits}
                      </span>{" "}
                      credits, your best possible final outcome is a{" "}
                      <span className="font-semibold text-white">
                        {calculations.bestPossible}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-xl font-semibold">What you need to average</h2>

                <div className="mt-4 space-y-4">
                  {[
                    { label: "First", target: calculations.firstNeeded },
                    { label: "2:1", target: calculations.twoOneNeeded },
                    { label: "2:2", target: calculations.twoTwoNeeded },
                    { label: "Third", target: calculations.thirdNeeded },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-lg font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="text-lg font-bold text-blue-300">
                          {item.target === null ? "—" : `${formatNumber(item.target)}%`}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {getTargetMessage(item.target, item.label)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-xl font-semibold">Important note</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  This tracker uses standard UK classification boundaries:
                  First = 70+, 2:1 = 60+, 2:2 = 50+, Third = 40+. Some universities
                  weight years differently, so this should be treated as an estimate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
