"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { ArrowLeft, TrendingUp } from "lucide-react";

type SnapshotRow = {
  user_id: string;
  snapshot_date: string;
  cooked_score: number;
  pending_tasks: number;
  completed_tasks: number;
  completion_rate: number;
};

export default function AnalyticsPage() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("leaderboard_snapshots")
        .select(
          "user_id, snapshot_date, cooked_score, pending_tasks, completed_tasks, completion_rate"
        )
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: true })
        .limit(30);

      if (error) {
        console.error("Error loading analytics:", error.message);
        setRows([]);
      } else {
        setRows((data as SnapshotRow[]) ?? []);
      }

      setLoading(false);
    }

    void loadAnalytics();
  }, []);

  const chartData = useMemo(() => {
    return rows.map((row) => ({
      date: new Date(row.snapshot_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      score: row.cooked_score,
      pending: row.pending_tasks,
      completed: row.completed_tasks,
      completion: row.completion_rate,
    }));
  }, [rows]);

  const latest = rows[rows.length - 1] ?? null;
  const bestScore =
    rows.length > 0 ? Math.min(...rows.map((row) => row.cooked_score)) : null;
  const avgCompletion =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + row.completion_rate, 0) / rows.length
        )
      : null;

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_24%)]" />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                <TrendingUp className="h-3.5 w-3.5" />
                Analytics
              </div>

              <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
                Your progress dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Track how cooked you were, how much you completed, and whether things are improving.
              </p>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Latest Score
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {loading ? "..." : latest?.cooked_score ?? 0}
              </p>
            </div>

            <div className="rounded-[24px] border border-emerald-400/20 bg-[#08122b] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">
                Best Score
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {loading ? "..." : bestScore ?? 0}
              </p>
            </div>

            <div className="rounded-[24px] border border-cyan-400/20 bg-[#08122b] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                Avg Completion
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {loading ? "..." : `${avgCompletion ?? 0}%`}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Cooked Score History</h2>
              <p className="mt-2 text-sm text-slate-400">
                Lower is better.
              </p>

              <div className="mt-6 h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" />
                    <YAxis stroke="rgba(255,255,255,0.45)" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#ffffff"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Completion Rate</h2>
              <p className="mt-2 text-sm text-slate-400">
                Higher is better.
              </p>

              <div className="mt-6 h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" />
                    <YAxis stroke="rgba(255,255,255,0.45)" />
                    <Tooltip />
                    <Bar dataKey="completion" fill="#ffffff" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Task Load Trend</h2>
            <p className="mt-2 text-sm text-slate-400">
              See whether your active workload is going down.
            </p>

            <div className="mt-6 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" />
                  <YAxis stroke="rgba(255,255,255,0.45)" />
                  <Tooltip />
                  <Bar dataKey="pending" fill="#ffffff" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}