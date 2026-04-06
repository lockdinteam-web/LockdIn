import AICoachPanel from "@/components/dashboard/AICoachPanel";

const tabs = ["Dashboard", "Tasks", "Planner", "Performance"];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#020817] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <section>
          <h1 className="text-5xl font-bold tracking-tight">LockdIn</h1>
          <p className="mt-3 text-xl text-slate-400">
            Plan smarter. Perform better.
          </p>
        </section>

        {/* Navigation Pills */}
        <section className="flex flex-wrap gap-4">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              className={`rounded-2xl border px-6 py-4 text-lg font-medium transition ${
                index === 0
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-slate-700 bg-transparent text-white hover:border-slate-500"
              }`}
            >
              {tab}
            </button>
          ))}
        </section>

        {/* Main Hero Stats */}
        <section className="rounded-[32px] border border-white/10 bg-[#08122b] p-10 shadow-[0_10px_50px_rgba(0,0,0,0.3)]">
          <h2 className="text-4xl font-semibold tracking-tight">
            Your AI academic operating system
          </h2>
          <p className="mt-4 max-w-4xl text-xl leading-8 text-slate-300">
            LockdIn helps university students organise deadlines, prioritise tasks,
            build realistic study plans, and improve academic performance with AI.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl bg-[#16233f] p-6">
              <p className="text-lg text-slate-400">Urgent Tasks</p>
              <p className="mt-4 text-5xl font-bold">4</p>
            </div>

            <div className="rounded-3xl bg-[#16233f] p-6">
              <p className="text-lg text-slate-400">Weekly Completion</p>
              <p className="mt-4 text-5xl font-bold">72%</p>
            </div>

            <div className="rounded-3xl bg-[#16233f] p-6">
              <p className="text-lg text-slate-400">Study Streak</p>
              <p className="mt-4 text-5xl font-bold">6 days</p>
            </div>
          </div>
        </section>

        {/* AI Coach */}
        <AICoachPanel />

        {/* Bottom Feature Cards */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-[#08122b] p-8">
            <h3 className="text-2xl font-semibold">Smart Prioritisation</h3>
            <p className="mt-4 text-lg leading-7 text-slate-300">
              Know exactly what task matters most today.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#08122b] p-8">
            <h3 className="text-2xl font-semibold">AI Study Planner</h3>
            <p className="mt-4 text-lg leading-7 text-slate-300">
              Generate realistic study blocks around deadlines.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#08122b] p-8">
            <h3 className="text-2xl font-semibold">Performance Insights</h3>
            <p className="mt-4 text-lg leading-7 text-slate-300">
              Track streaks, weak modules, and neglected subjects.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}