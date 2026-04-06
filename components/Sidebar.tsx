"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/planner", label: "Planner" },
  { href: "/performance", label: "Performance" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl">
      <div className="border-b border-slate-800 px-6 py-6">
        <Link
          href="/"
          className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-slate-900/80 p-4 transition hover:border-blue-400/30 hover:bg-slate-900"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-lg">
            <Image
              src="/logo.png"
              alt="LockdIn logo"
              width={42}
              height={42}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>

          <div>
            <p className="text-lg font-semibold tracking-tight text-white">
              LockdIn
            </p>
            <p className="text-xs text-slate-400">
              Productivity Workspace
            </p>
          </div>
        </Link>
      </div>

      <div className="flex-1 px-4 py-6">
        <p className="mb-4 px-3 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
          Navigation
        </p>

        <nav className="space-y-2">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className="relative">
                  {link.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 h-[2px] w-full rounded-full bg-blue-400" />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 px-6 py-5">
        <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            LockdIn
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Stay focused, protect your momentum, and keep your deadlines under control.
          </p>
        </div>
      </div>
    </aside>
  );
}