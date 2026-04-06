"use client";

import { useMemo, useState } from "react";
import { getAssistantAdvice } from "./rules";
import { AssistantInput, Scenario } from "./types";

const scenarioOptions: { value: Scenario; label: string }[] = [
  { value: "no_reply", label: "No reply" },
  { value: "mixed_signals", label: "Mixed signals" },
  { value: "cancelled_plans", label: "Cancelled plans" },
  { value: "breadcrumbing", label: "Breadcrumbing" },
  { value: "late_night_only", label: "Late-night only" },
  { value: "ghost_return", label: "Came back after disappearing" },
  { value: "love_bombing", label: "Love bombing" },
  { value: "inconsistent_effort", label: "Inconsistent effort" },
];

function riskClasses(risk: "low" | "caution" | "high") {
  switch (risk) {
    case "low":
      return "bg-green-100 text-green-700 border-green-200";
    case "caution":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function AssistantTool() {
  const [form, setForm] = useState<AssistantInput>({
    scenario: "no_reply",
    daysSinceReply: 1,
    repeatPattern: false,
    gaveReason: false,
    stillWatchingStories: false,
    madeRealPlans: false,
    onlyLateNight: false,
  });

  const result = useMemo(() => getAssistantAdvice(form), [form]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900">Assistant Check</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Pick the situation and answer a few quick questions.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-800">
              Scenario
            </label>
            <select
              value={form.scenario}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  scenario: e.target.value as Scenario,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            >
              {scenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-800">
              Days since last reply
            </label>
            <input
              type="number"
              min={0}
              value={form.daysSinceReply ?? 0}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  daysSinceReply: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
            <span className="text-sm text-neutral-800">Has this happened before?</span>
            <input
              type="checkbox"
              checked={!!form.repeatPattern}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  repeatPattern: e.target.checked,
                }))
              }
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
            <span className="text-sm text-neutral-800">Did they give a reason?</span>
            <input
              type="checkbox"
              checked={!!form.gaveReason}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  gaveReason: e.target.checked,
                }))
              }
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
            <span className="text-sm text-neutral-800">Are they still making real plans?</span>
            <input
              type="checkbox"
              checked={!!form.madeRealPlans}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  madeRealPlans: e.target.checked,
                }))
              }
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
            <span className="text-sm text-neutral-800">Are they still watching stories / lurking?</span>
            <input
              type="checkbox"
              checked={!!form.stillWatchingStories}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  stillWatchingStories: e.target.checked,
                }))
              }
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
            <span className="text-sm text-neutral-800">Is it mostly late-night contact?</span>
            <input
              type="checkbox"
              checked={!!form.onlyLateNight}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  onlyLateNight: e.target.checked,
                }))
              }
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">Your Result</h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${riskClasses(
              result.risk
            )}`}
          >
            {result.risk}
          </span>
        </div>

        <div className="mt-5">
          <h3 className="text-2xl font-bold text-neutral-900">{result.verdict}</h3>
          <p className="mt-2 text-sm text-neutral-600">{result.summary}</p>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-neutral-900">Why this is the verdict</h4>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {result.reasoning.map((item, index) => (
              <li key={index} className="rounded-xl bg-neutral-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-2xl bg-neutral-50 p-4">
          <h4 className="text-sm font-semibold text-neutral-900">Best next move</h4>
          <p className="mt-2 text-sm text-neutral-700">{result.nextStep}</p>
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <h4 className="text-sm font-semibold text-neutral-900">Avoid this</h4>
          <p className="mt-2 text-sm text-neutral-700">{result.avoid}</p>
        </div>
      </div>
    </div>
  );
}