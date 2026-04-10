"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/components/TasksProvider";
import { supabase } from "@/lib/supabase";
import {
  calculateCookedScore,
  getBestRecoveryAction,
  type StudyBlock,
} from "@/lib/calculateCookedScore";
import {
  upsertTodayLeaderboardSnapshot,
  recordActivityDay,
} from "@/lib/leaderboard";
import {
  Trophy,
  Flame,
  Sparkles,
  ClipboardList,
  CalendarDays,
  BarChart3,
  ChevronRight,
  Crown,
  Target,
  Zap,
  Shield,
  Medal,
  Share2,
  Clock3,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Star,
  TrendingUp,
  Users,
  TimerReset,
} from "lucide-react";

type Priority = "High" | "Medium" | "Low";

type HomeTask = {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

type DatabaseTask = {
  id: string;
  user_id: string;
  title: string;
  module: string;
  due_date: string;
  priority: Priority;
  completed: boolean;
};

type HomeProfile = {
  username: string;
  university: string;
  course: string;
  xp: number;
  level: number;
  streak: number;
  best_streak: number;
  last_active_date: string | null;
  premium: boolean;
};

type LeaderboardProfile = {
  id: string;
  username: string;
  university: string;
  course: string;
};

type FriendConnection = {
  user_id: string;
  friend_id: string;
};

type LeaderboardSnapshotRow = {
  user_id: string;
  snapshot_date: string;
  cooked_score: number;
  pending_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  updated_at?: string;
};

type ActivityDayRow = {
  user_id: string;
  activity_date: string;
};

type LeaderboardMode =
  | "mostCooked"
  | "biggestComeback"
  | "mostLockedIn"
  | "mostActive";

type LeaderboardEntry = {
  id: string;
  username: string;
  university: string;
  course: string;
  cookedScore: number;
  status: string;
  pendingTasks: number;
  completedTasks: number;
  completionRate: number;
  weeklyCookedChange: number;
  weeklyPendingChange: number;
  streak: number;
  rank: number;
  isYou: boolean;
  momentumLabel: string;
  roastLabel: string;
};

type DatabaseStudyBlock = {
  id: string;
  user_id: string;
  day: string;
  time: string;
  subject: string;
  focus: string;
  task_id: string | null;
  duration_minutes: number;
  completed: boolean;
  location: string;
};

type HomeStudyBlock = StudyBlock & {
  location?: string;
};

const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

  if (Number.isNaN(due.getTime())) return 999;

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function safeParseArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getDateDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function calculateStreak(activityDates: string[]) {
  if (activityDates.length === 0) return 0;

  const set = new Set(activityDates);
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getPriorityBadge(priority: Priority) {
  if (priority === "High") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20";
  }
  if (priority === "Medium") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20";
  }
  return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20";
}

function getCookedTextColor(score: number) {
  if (score <= 20) return "text-emerald-300";
  if (score <= 40) return "text-lime-300";
  if (score <= 60) return "text-amber-300";
  if (score <= 80) return "text-orange-300";
  return "text-rose-300";
}

function getCookedBarClass(score: number) {
  if (score <= 20) return "bg-emerald-500";
  if (score <= 40) return "bg-lime-500";
  if (score <= 60) return "bg-amber-500";
  if (score <= 80) return "bg-orange-500";
  return "bg-rose-500";
}

function getCookedGlowClass(score: number) {
  if (score <= 20) return "shadow-[0_0_60px_rgba(16,185,129,0.16)]";
  if (score <= 40) return "shadow-[0_0_60px_rgba(132,204,22,0.16)]";
  if (score <= 60) return "shadow-[0_0_60px_rgba(245,158,11,0.16)]";
  if (score <= 80) return "shadow-[0_0_60px_rgba(249,115,22,0.16)]";
  return "shadow-[0_0_60px_rgba(244,63,94,0.16)]";
}

function getCookedZone(score: number) {
  if (score <= 20) return "Locked In";
  if (score <= 40) return "Stable";
  if (score <= 60) return "Under Pressure";
  if (score <= 80) return "Cooked";
  return "Deep Fried";
}

function getRoastLabel(score: number) {
  if (score <= 15) return "Academic Weapon";
  if (score <= 30) return "Suspiciously Organised";
  if (score <= 45) return "Still Calm";
  if (score <= 60) return "Pressure Building";
  if (score <= 75) return "Slightly Fried";
  if (score <= 90) return "Properly Cooked";
  return "Deep Fried";
}

function getMomentumLabel(completionRate: number, pendingTasks: number) {
  if (pendingTasks === 0) return "Board Clear";
  if (completionRate >= 80) return "Flying";
  if (completionRate >= 60) return "Good Momentum";
  if (completionRate >= 35) return "In Motion";
  return "Needs Locking In";
}

function getUpcomingLabel(days: number) {
  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function getMotivationLine(score: number, pending: number, overdue: number) {
  if (overdue > 0) {
    return "You do not need a new plan. You need to clear overdue work first.";
  }
  if (score >= 85) {
    return "This is recoverable, but only if you lock in today.";
  }
  if (score >= 65) {
    return "You’re still in control, but the pressure is building fast.";
  }
  if (pending >= 5) {
    return "You’re not behind yet, but the workload is starting to stack.";
  }
  if (pending > 0) {
    return "Momentum is good. Keep finishing what is already in motion.";
  }
  return "Clean board. This is the perfect time to stay ahead.";
}

function getHeroSubtitle(score: number) {
  if (score >= 80) {
    return "Your deadlines are starting to fight back.";
  }
  if (score >= 60) {
    return "Pressure is rising. Good time to move.";
  }
  if (score >= 40) {
    return "Not bad. Still room to tighten up.";
  }
  return "You’re looking suspiciously organised.";
}

function getLeaderboardAccent(score: number) {
  if (score >= 85) return "border-rose-400/25 bg-rose-500/10";
  if (score >= 65) return "border-orange-400/25 bg-orange-500/10";
  if (score >= 40) return "border-amber-400/25 bg-amber-500/10";
  return "border-emerald-400/25 bg-emerald-500/10";
}

function getLevelFromXp(xp: number) {
  return Math.floor(xp / 100) + 1;
}

function getXpIntoCurrentLevel(xp: number) {
  return xp % 100;
}

function getXpNeededForNextLevel() {
  return 100;
}

function normalizeDayLabel(value: string) {
  return value.trim().toLowerCase();
}

function blockMatchesToday(blockDay: string, today: Date) {
  const raw = normalizeDayLabel(blockDay);

  const longDay = today
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();
  const shortDay = today
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toLowerCase();

  if (raw === longDay || raw === shortDay) return true;

  const dayAliases: Record<string, string[]> = {
    monday: ["mon"],
    tuesday: ["tue", "tues"],
    wednesday: ["wed"],
    thursday: ["thu", "thur", "thurs"],
    friday: ["fri"],
    saturday: ["sat"],
    sunday: ["sun"],
  };

  for (const [full, aliases] of Object.entries(dayAliases)) {
    if (
      (raw === full || aliases.includes(raw)) &&
      (longDay === full || aliases.includes(longDay))
    ) {
      return true;
    }
  }

  const parsed = new Date(blockDay);
  if (!Number.isNaN(parsed.getTime())) {
    return (
      parsed.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)
    );
  }

  return false;
}

function parseTimeToMinutes(value: string) {
  if (!value) return 9999;

  const simple = value.match(/^(\d{1,2}):(\d{2})$/);
  if (simple) {
    return Number(simple[1]) * 60 + Number(simple[2]);
  }

  const ampm = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minutes = Number(ampm[2] ?? "0");
    const suffix = ampm[3].toLowerCase();
    if (suffix === "pm" && hour !== 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    return hour * 60 + minutes;
  }

  return 9999;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function syncDailyProfileProgress(
  userId: string,
  profile: HomeProfile
): Promise<HomeProfile> {
  const today = getTodayDate();
  const yesterday = getDateDaysAgo(1);

  if (profile.last_active_date === today) {
    return {
      ...profile,
      level: profile.level || getLevelFromXp(profile.xp || 0),
    };
  }

  let nextStreak = 1;

  if (profile.last_active_date === yesterday) {
    nextStreak = (profile.streak ?? 0) + 1;
  }

  const nextBestStreak = Math.max(profile.best_streak ?? 0, nextStreak);
  const nextLevel = getLevelFromXp(profile.xp ?? 0);

  const { error } = await supabase
    .from("profiles")
    .update({
      streak: nextStreak,
      best_streak: nextBestStreak,
      level: nextLevel,
      last_active_date: today,
    })
    .eq("id", userId);

  if (error) {
    console.error("Error syncing daily profile progress:", error.message);
    return {
      ...profile,
      level: nextLevel,
    };
  }

  return {
    ...profile,
    streak: nextStreak,
    best_streak: nextBestStreak,
    level: nextLevel,
    last_active_date: today,
  };
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,32,0.88),rgba(7,12,24,0.92))] backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.34)] ${className}`}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { tasks: providerTasks, loading } = useTasks();

  const [studyBlocks, setStudyBlocks] = useState<HomeStudyBlock[]>([]);
  const [studyBlocksLoading, setStudyBlocksLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardMode, setLeaderboardMode] =
    useState<LeaderboardMode>("mostCooked");

  const [friendUsername, setFriendUsername] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");

  const [shareMessage, setShareMessage] = useState("");

  async function loadStudyBlocks(userId: string) {
    try {
      setStudyBlocksLoading(true);

      const { data, error } = await supabase
        .from("study_plan_blocks")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading study blocks:", error.message);

        if (typeof window !== "undefined") {
          const fallback = safeParseArray<HomeStudyBlock>(
            localStorage.getItem(STUDY_PLAN_STORAGE_KEY)
          );
          setStudyBlocks(fallback);
        } else {
          setStudyBlocks([]);
        }
        return;
      }

      const mapped: HomeStudyBlock[] = ((data ?? []) as DatabaseStudyBlock[]).map(
        (block) => ({
          id: block.id,
          day: block.day,
          time: block.time,
          subject: block.subject,
          focus: block.focus,
          taskId: block.task_id ?? "",
          durationMinutes: block.duration_minutes,
          completed: block.completed,
          location: block.location,
        })
      );

      setStudyBlocks(mapped);

      if (typeof window !== "undefined") {
        localStorage.setItem(STUDY_PLAN_STORAGE_KEY, JSON.stringify(mapped));
      }
    } catch (error) {
      console.error("Unexpected study blocks error:", error);
      setStudyBlocks([]);
    } finally {
      setStudyBlocksLoading(false);
    }
  }

  async function loadLeaderboard(userId: string) {
    try {
      setLeaderboardLoading(true);

      const { data: connectionRows, error: connectionError } = await supabase
        .from("friend_connections")
        .select("user_id, friend_id")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (connectionError) {
        console.error(
          "Error loading friend connections:",
          connectionError.message
        );
        setLeaderboard([]);
        return;
      }

      const friendIds = Array.from(
        new Set(
          ((connectionRows as FriendConnection[] | null) ?? []).map((row) =>
            row.user_id === userId ? row.friend_id : row.user_id
          )
        )
      );

      const allIds = Array.from(new Set([userId, ...friendIds]));

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, university, course")
        .in("id", allIds);

      if (profileError) {
        console.error(
          "Error loading leaderboard profiles:",
          profileError.message
        );
        setLeaderboard([]);
        return;
      }

      const { data: taskRows, error: taskError } = await supabase
        .from("tasks")
        .select("id, user_id, title, module, due_date, priority, completed")
        .in("user_id", allIds);

      if (taskError) {
        console.error("Error loading leaderboard tasks:", taskError.message);
        setLeaderboard([]);
        return;
      }

      const { data: snapshotRows, error: snapshotError } = await supabase
        .from("leaderboard_snapshots")
        .select(
          "user_id, snapshot_date, cooked_score, pending_tasks, completed_tasks, completion_rate, updated_at"
        )
        .in("user_id", allIds)
        .gte("snapshot_date", getDateDaysAgo(7));

      if (snapshotError) {
        console.error(
          "Error loading leaderboard snapshots:",
          snapshotError.message
        );
        setLeaderboard([]);
        return;
      }

      const { data: activityRows, error: activityError } = await supabase
        .from("user_activity_days")
        .select("user_id, activity_date")
        .in("user_id", allIds)
        .gte("activity_date", getDateDaysAgo(30));

      if (activityError) {
        console.error("Error loading activity days:", activityError.message);
        setLeaderboard([]);
        return;
      }

      const tasksByUser = new Map<string, HomeTask[]>();
      ((taskRows as DatabaseTask[] | null) ?? []).forEach((task) => {
        const mapped: HomeTask = {
          id: task.id,
          title: task.title,
          module: task.module,
          dueDate: task.due_date,
          priority: task.priority,
          completed: task.completed,
        };

        const existing = tasksByUser.get(task.user_id) ?? [];
        existing.push(mapped);
        tasksByUser.set(task.user_id, existing);
      });

      const snapshotsByUser = new Map<string, LeaderboardSnapshotRow[]>();
      ((snapshotRows as LeaderboardSnapshotRow[] | null) ?? []).forEach((row) => {
        const existing = snapshotsByUser.get(row.user_id) ?? [];
        existing.push(row);
        snapshotsByUser.set(row.user_id, existing);
      });

      const activityByUser = new Map<string, string[]>();
      ((activityRows as ActivityDayRow[] | null) ?? []).forEach((row) => {
        const existing = activityByUser.get(row.user_id) ?? [];
        existing.push(row.activity_date);
        activityByUser.set(row.user_id, existing);
      });

      const entries: LeaderboardEntry[] = (
        (profileRows as LeaderboardProfile[] | null) ?? []
      ).map((person) => {
        const personTasks = tasksByUser.get(person.id) ?? [];

        const personSnapshots = [...(snapshotsByUser.get(person.id) ?? [])].sort(
          (a, b) => {
            if (a.snapshot_date !== b.snapshot_date) {
              return b.snapshot_date.localeCompare(a.snapshot_date);
            }
            return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
          }
        );

        const latestSnapshot = personSnapshots[0] ?? null;
        const oldestSnapshot = personSnapshots[personSnapshots.length - 1] ?? null;

        const pendingTasks =
          latestSnapshot?.pending_tasks ??
          personTasks.filter((task) => !task.completed).length;

        const completedTasks =
          latestSnapshot?.completed_tasks ??
          personTasks.filter((task) => task.completed).length;

        const completionRate =
          latestSnapshot?.completion_rate ??
          (personTasks.length > 0
            ? Math.round((completedTasks / personTasks.length) * 100)
            : 0);

        const cookedScore =
          latestSnapshot?.cooked_score ??
          calculateCookedScore(personTasks, []).score;

        const weeklyCookedChange =
          latestSnapshot && oldestSnapshot
            ? latestSnapshot.cooked_score - oldestSnapshot.cooked_score
            : 0;

        const weeklyPendingChange =
          latestSnapshot && oldestSnapshot
            ? latestSnapshot.pending_tasks - oldestSnapshot.pending_tasks
            : 0;

        const streak = calculateStreak(activityByUser.get(person.id) ?? []);

        return {
          id: person.id,
          username: person.username,
          university: person.university,
          course: person.course,
          cookedScore,
          status: getCookedZone(cookedScore),
          pendingTasks,
          completedTasks,
          completionRate,
          weeklyCookedChange,
          weeklyPendingChange,
          streak,
          rank: 0,
          isYou: person.id === userId,
          momentumLabel: getMomentumLabel(completionRate, pendingTasks),
          roastLabel: getRoastLabel(cookedScore),
        };
      });

      setLeaderboard(entries);
    } catch (error) {
      console.error("Unexpected leaderboard error:", error);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  async function handleAddFriend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!currentUserId) {
      setFriendError("You need to be logged in.");
      return;
    }

    const cleanUsername = friendUsername.trim().replace(/^@/, "").toLowerCase();

    if (!cleanUsername) {
      setFriendError("Enter a username first.");
      return;
    }

    try {
      setAddingFriend(true);
      setFriendError("");
      setFriendSuccess("");

      const { data: foundUsers, error: findError } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", cleanUsername);

      if (findError) {
        console.error("Could not search for username:", findError);
        setFriendError(findError.message || "Could not search for that username.");
        return;
      }

      const foundUser =
        foundUsers?.find(
          (user) => user.username?.toLowerCase() === cleanUsername
        ) ?? null;

      if (!foundUser) {
        setFriendError("No user found with that username.");
        return;
      }

      if (foundUser.id === currentUserId) {
        setFriendError("You cannot add yourself.");
        return;
      }

      const { data: existingConnections, error: existingError } = await supabase
        .from("friend_connections")
        .select("user_id, friend_id")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${foundUser.id}),and(user_id.eq.${foundUser.id},friend_id.eq.${currentUserId})`
        );

      if (existingError) {
        console.error("Could not check existing connections:", existingError);
        setFriendError(
          existingError.message || "Could not check existing connections."
        );
        return;
      }

      if ((existingConnections ?? []).length > 0) {
        setFriendError("That friend is already on your leaderboard.");
        return;
      }

      const { error: insertError } = await supabase
        .from("friend_connections")
        .insert({
          user_id: currentUserId,
          friend_id: foundUser.id,
        });

      if (insertError) {
        console.error("Add friend insert error:", insertError);
        setFriendError(insertError.message || "Could not add that friend.");
        return;
      }

      setFriendSuccess(`@${foundUser.username} added to your leaderboard.`);
      setFriendUsername("");
      await loadLeaderboard(currentUserId);
    } catch (error) {
      console.error("Unexpected add friend error:", error);
      setFriendError("Something went wrong while adding that friend.");
    } finally {
      setAddingFriend(false);
    }
  }

  async function handleCopyInvite() {
    if (!profile?.username) return;

    const inviteLink =
      typeof window !== "undefined"
        ? `${window.location.origin}/signup?invite=${profile.username}`
        : `Invite me to LockdIn — username: @${profile.username}`;

    const ok = await copyText(inviteLink);
    setShareMessage(ok ? "Invite link copied." : "Could not copy invite link.");
    setTimeout(() => setShareMessage(""), 2500);
  }

  async function handleShareScore(score: number) {
    const text = `My LockdIn Cooked Score is ${score}/100 (${getRoastLabel(
      score
    )}). How cooked are you?`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "LockdIn Cooked Score",
          text,
        });
        setShareMessage("Score shared.");
      } catch {
        const ok = await copyText(text);
        setShareMessage(ok ? "Score copied." : "Could not share score.");
      }
    } else {
      const ok = await copyText(text);
      setShareMessage(ok ? "Score copied." : "Could not copy score.");
    }

    setTimeout(() => setShareMessage(""), 2500);
  }

  async function handleShareLeaderboard(entries: LeaderboardEntry[]) {
    const lines = entries
      .slice(0, 5)
      .map((entry, index) => `${index + 1}. @${entry.username} — ${entry.cookedScore}/100`);

    const text = `🔥 LockdIn Cooked Leaderboard\n${lines.join(
      "\n"
    )}\n\nHow cooked are you?`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "LockdIn Cooked Leaderboard",
          text,
        });
        setShareMessage("Leaderboard shared.");
      } catch {
        const ok = await copyText(text);
        setShareMessage(ok ? "Leaderboard copied." : "Could not share leaderboard.");
      }
    } else {
      const ok = await copyText(text);
      setShareMessage(ok ? "Leaderboard copied." : "Could not copy leaderboard.");
    }

    setTimeout(() => setShareMessage(""), 2500);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStudyBlocks(
        safeParseArray<HomeStudyBlock>(localStorage.getItem(STUDY_PLAN_STORAGE_KEY))
      );
    }

    let mounted = true;

    async function checkAuthAndProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const user = session?.user ?? null;

      setIsLoggedIn(!!user);
      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setProfile(null);
        setLeaderboard([]);
        setLeaderboardLoading(false);
        setStudyBlocks([]);
        setStudyBlocksLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "username, university, course, xp, level, streak, best_streak, last_active_date, premium"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!profileData) {
        router.push("/onboarding");
        return;
      }

      const syncedProfile = await syncDailyProfileProgress(user.id, {
        username: profileData.username,
        university: profileData.university,
        course: profileData.course,
        xp: profileData.xp ?? 0,
        level: profileData.level ?? 1,
        streak: profileData.streak ?? 0,
        best_streak: profileData.best_streak ?? 0,
        last_active_date: profileData.last_active_date ?? null,
        premium: profileData.premium ?? false,
      });

      if (!mounted) return;

      setProfile(syncedProfile);
      await Promise.all([loadLeaderboard(user.id), loadStudyBlocks(user.id)]);
    }

    void checkAuthAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;
      setIsLoggedIn(!!user);
      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setProfile(null);
        setLeaderboard([]);
        setLeaderboardLoading(false);
        setStudyBlocks([]);
        setStudyBlocksLoading(false);
        return;
      }

      void checkAuthAndProfile();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkAuthAndProfile();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const tasks = useMemo<HomeTask[]>(() => {
    return ((providerTasks ?? []) as Array<Record<string, unknown>>).map((task) => ({
      id: String(task.id ?? ""),
      title: String(task.title ?? ""),
      module: String(task.module ?? ""),
      dueDate: String(task.dueDate ?? task.due_date ?? ""),
      priority: (task.priority as Priority) ?? "Low",
      completed: Boolean(task.completed),
    }));
  }, [providerTasks]);

  useEffect(() => {
    async function syncMySnapshot() {
      if (!currentUserId || loading || studyBlocksLoading) return;

      const leaderboardTasks = tasks.map((task) => ({
        id: task.id,
        title: task.title,
        module: task.module,
        dueDate: task.dueDate,
        priority: task.priority,
        completed: task.completed,
      }));

      await upsertTodayLeaderboardSnapshot(
        currentUserId,
        leaderboardTasks,
        studyBlocks
      );

      await recordActivityDay(currentUserId);
    }

    void syncMySnapshot();
  }, [currentUserId, tasks, studyBlocks, loading, studyBlocksLoading]);

  useEffect(() => {
    if (!currentUserId || loading) return;
    void loadLeaderboard(currentUserId);
  }, [currentUserId, tasks, loading]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.completed).length;
    const pending = tasks.filter((task) => !task.completed).length;
    const highPriority = tasks.filter(
      (task) => !task.completed && task.priority === "High"
    ).length;

    const overdue = tasks.filter(
      (task) => !task.completed && getDaysUntil(task.dueDate) < 0
    ).length;

    const urgent = tasks.filter((task) => {
      if (task.completed) return false;
      const days = getDaysUntil(task.dueDate);
      return days >= 0 && days <= 1;
    }).length;

    const dueThisWeek = tasks.filter((task) => {
      if (task.completed) return false;
      const days = getDaysUntil(task.dueDate);
      return days >= 0 && days <= 7;
    }).length;

    const upcoming = [...tasks]
      .filter((task) => !task.completed)
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

    const nextTask = upcoming[0] ?? null;

    const completionRate =
      tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    const completedStudyBlocks = studyBlocks.filter((block) => block.completed).length;
    const openStudyBlocks = studyBlocks.filter((block) => !block.completed).length;

    const studyHours =
      Math.round(
        (studyBlocks.reduce(
          (sum, block) => sum + Number(block.durationMinutes ?? 0),
          0
        ) /
          60) *
          10
      ) / 10;

    const plannerCompletionRate =
      studyBlocks.length > 0
        ? Math.round((completedStudyBlocks / studyBlocks.length) * 100)
        : 0;

    const recent = [...tasks]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4);

    return {
      completed,
      pending,
      highPriority,
      overdue,
      urgent,
      dueThisWeek,
      nextTask,
      completionRate,
      completedStudyBlocks,
      openStudyBlocks,
      studyHours,
      plannerCompletionRate,
      recent,
    };
  }, [tasks, studyBlocks]);

  const cooked = useMemo(() => {
    return calculateCookedScore(tasks, studyBlocks);
  }, [tasks, studyBlocks]);

  const bestRecoveryAction = useMemo(() => {
    return getBestRecoveryAction(tasks, studyBlocks);
  }, [tasks, studyBlocks]);

  const biggestThreat = useMemo(() => {
    return [...tasks]
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const aDays = getDaysUntil(a.dueDate);
        const bDays = getDaysUntil(b.dueDate);

        const aScore =
          (aDays < 0 ? 100 : aDays === 0 ? 80 : aDays === 1 ? 65 : aDays <= 3 ? 45 : 20) +
          (a.priority === "High" ? 25 : a.priority === "Medium" ? 15 : 8);

        const bScore =
          (bDays < 0 ? 100 : bDays === 0 ? 80 : bDays === 1 ? 65 : bDays <= 3 ? 45 : 20) +
          (b.priority === "High" ? 25 : b.priority === "Medium" ? 15 : 8);

        return bScore - aScore;
      })[0] ?? null;
  }, [tasks]);

  const todayFocus = useMemo(() => {
    return [...tasks]
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const aDays = getDaysUntil(a.dueDate);
        const bDays = getDaysUntil(b.dueDate);

        const aValue =
          (aDays < 0 ? 100 : aDays === 0 ? 90 : aDays === 1 ? 75 : aDays <= 3 ? 55 : 20) +
          (a.priority === "High" ? 30 : a.priority === "Medium" ? 18 : 8);

        const bValue =
          (bDays < 0 ? 100 : bDays === 0 ? 90 : bDays === 1 ? 75 : bDays <= 3 ? 55 : 20) +
          (b.priority === "High" ? 30 : b.priority === "Medium" ? 18 : 8);

        return bValue - aValue;
      })
      .slice(0, 3);
  }, [tasks]);

  const todaysStudyBlocks = useMemo(() => {
    const today = new Date();

    return [...studyBlocks]
      .filter((block) => blockMatchesToday(String(block.day ?? ""), today))
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }, [studyBlocks]);

  const coachTitle =
    stats.overdue > 0
      ? "Clear overdue work before anything else"
      : stats.highPriority > 0
      ? "High-priority work needs your focus"
      : stats.pending > 0
      ? "Your edge comes from finishing, not adding more"
      : "You’re in a strong position right now";

  const coachMessage =
    stats.overdue > 0
      ? `You have ${stats.overdue} overdue task${
          stats.overdue === 1 ? "" : "s"
        }. That is the main thing dragging your score up right now.`
      : stats.highPriority > 0
      ? `You still have ${stats.highPriority} high-priority task${
          stats.highPriority === 1 ? "" : "s"
        } open. Finishing one of those will shift things fastest.`
      : stats.pending > 0
      ? `You have ${stats.pending} active task${
          stats.pending === 1 ? "" : "s"
        } in motion. Protect momentum by finishing what is already open.`
      : "No current backlog. Best move now is staying ahead before pressure builds again.";

  const sortedLeaderboard = useMemo(() => {
    const cloned = [...leaderboard];

    if (leaderboardMode === "mostCooked") {
      return cloned
        .sort((a, b) => {
          if (b.cookedScore !== a.cookedScore) return b.cookedScore - a.cookedScore;
          return b.pendingTasks - a.pendingTasks;
        })
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    if (leaderboardMode === "biggestComeback") {
      return cloned
        .sort((a, b) => {
          if (a.weeklyCookedChange !== b.weeklyCookedChange) {
            return a.weeklyCookedChange - b.weeklyCookedChange;
          }
          return a.cookedScore - b.cookedScore;
        })
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    if (leaderboardMode === "mostLockedIn") {
      return cloned
        .sort((a, b) => {
          if (a.cookedScore !== b.cookedScore) return a.cookedScore - b.cookedScore;
          if (b.streak !== a.streak) return b.streak - a.streak;
          return b.completionRate - a.completionRate;
        })
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    return cloned
      .sort((a, b) => {
        if (b.pendingTasks !== a.pendingTasks) return b.pendingTasks - a.pendingTasks;
        return b.cookedScore - a.cookedScore;
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [leaderboard, leaderboardMode]);

  const leaderboardHeadline = useMemo(() => {
    if (!sortedLeaderboard.length) return "No rankings yet";

    const top = sortedLeaderboard[0];

    if (leaderboardMode === "mostCooked") {
      return `@${top.username} is currently the most cooked.`;
    }
    if (leaderboardMode === "biggestComeback") {
      if (top.weeklyCookedChange < 0) {
        return `@${top.username} has made the best comeback this week.`;
      }
      return "Nobody has recovered this week yet.";
    }
    if (leaderboardMode === "mostLockedIn") {
      return `@${top.username} is currently the least cooked.`;
    }
    return `@${top.username} is carrying the heaviest active workload.`;
  }, [sortedLeaderboard, leaderboardMode]);

  const yourRank = useMemo(() => {
    return sortedLeaderboard.find((entry) => entry.isYou)?.rank ?? null;
  }, [sortedLeaderboard]);

  const profileLevel = profile?.level ?? getLevelFromXp(profile?.xp ?? 0);
  const xpIntoLevel = getXpIntoCurrentLevel(profile?.xp ?? 0);
  const xpNeededForNextLevel = getXpNeededForNextLevel();
  const levelProgress = Math.min((xpIntoLevel / xpNeededForNextLevel) * 100, 100);

  const isLoadingPage = loading || leaderboardLoading || studyBlocksLoading;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.10),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_24%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_20%,transparent_80%,rgba(255,255,255,0.02)_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <GlassCard className="relative overflow-hidden p-5 sm:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_28%)]" />
              <div className="relative">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 sm:text-sm">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    Premium student control centre
                  </div>

                  {isLoggedIn && profile ? (
                    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6,#8b5cf6)] text-sm font-semibold text-white shadow-lg shadow-blue-500/20">
                        {profile.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          @{profile.username}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {profile.course} • {profile.university}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
                    >
                      Log in
                    </Link>
                  )}
                </div>

                <div className="mt-7 max-w-3xl">
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl xl:text-6xl">
                    The home page that
                    <span className="bg-[linear-gradient(90deg,#60a5fa,#c084fc,#f472b6)] bg-clip-text text-transparent">
                      {" "}
                      makes you lock in.
                    </span>
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                    See your pressure level, what to attack first, how your plan looks
                    today, and where you stand against your friends — all in one
                    premium dashboard.
                  </p>
                  <p className="mt-3 text-sm text-slate-400">
                    {loading ? "Loading..." : getHeroSubtitle(cooked.score)}
                  </p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-orange-400/20 bg-orange-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-orange-200/70">
                      Streak
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-300" />
                      <p className="text-2xl font-semibold text-white">
                        {profile ? profile.streak : 0}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-orange-200/70">
                      Best: {profile ? profile.best_streak : 0}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">
                      Level
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-cyan-300" />
                      <p className="text-2xl font-semibold text-white">
                        {profileLevel}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-cyan-200/70">
                      {profile?.xp ?? 0} XP
                    </p>
                  </div>

                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                      Completion
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {loading ? "..." : `${stats.completionRate}%`}
                    </p>
                    <p className="mt-2 text-xs text-emerald-200/70">
                      {loading ? "..." : `${stats.completed} finished`}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Due This Week
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {loading ? "..." : stats.dueThisWeek}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {loading ? "..." : `${stats.pending} active tasks`}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/tasks"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#3b82f6)] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition hover:scale-[1.01] hover:brightness-110"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Open Tasks
                  </Link>

                  <Link
                    href="/planner"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Open Planner
                  </Link>

                  <Link
                    href="/badges"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-6 py-3 text-sm font-medium text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20"
                  >
                    <Medal className="h-4 w-4" />
                    Badges
                  </Link>

                  <Link
                    href="/degree-tracker"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-6 py-3 text-sm font-medium text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Degree Tracker
                  </Link>
                </div>

                {shareMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {shareMessage}
                  </div>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard
              className={`relative overflow-hidden p-5 sm:p-6 ${getCookedGlowClass(
                cooked.score
              )}`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_46%)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      Live Cooked Score
                    </p>
                    <div className="mt-4 flex items-end gap-3">
                      <span
                        className={`text-6xl font-semibold sm:text-7xl ${getCookedTextColor(
                          cooked.score
                        )}`}
                      >
                        {loading ? "..." : cooked.score}
                      </span>
                      <span className="pb-2 text-2xl text-slate-500">/100</span>
                    </div>
                    <p className="mt-2 text-base font-medium text-white">
                      {loading ? "Loading..." : getCookedZone(cooked.score)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {loading ? "..." : getRoastLabel(cooked.score)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {loading ? "Loading..." : cooked.status}
                    </p>
                  </div>
                </div>

                <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getCookedBarClass(
                      cooked.score
                    )}`}
                    style={{
                      width: `${Math.max(8, loading ? 8 : cooked.score)}%`,
                    }}
                  />
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {loading
                    ? "Loading your dashboard..."
                    : getMotivationLine(cooked.score, stats.pending, stats.overdue)}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Active
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {stats.pending}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Urgent
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {stats.urgent}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Study Hrs
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {loading ? "..." : stats.studyHours}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Level Progress
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        Level {profileLevel}
                      </p>
                    </div>
                    <p className="text-sm text-slate-400">
                      {xpIntoLevel}/{xpNeededForNextLevel} XP
                    </p>
                  </div>

                  <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${Math.max(6, levelProgress)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleShareScore(cooked.score)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Share my score
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
                  >
                    Copy invite link
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Powered by
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">LockdIn</p>
                  </div>
                  <Image
                    src="/logo.png"
                    alt="LockdIn logo"
                    width={110}
                    height={110}
                    className="h-auto w-[74px] object-contain opacity-95"
                    priority
                  />
                </div>
              </div>
            </GlassCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <GlassCard className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-400/20">
                    <Users className="h-3.5 w-3.5" />
                    Social Pressure
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Cooked Leaderboard
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {leaderboardHeadline}
                  </p>
                  {yourRank ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Your current rank: #{yourRank}
                    </p>
                  ) : null}
                </div>

                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => handleShareLeaderboard(sortedLeaderboard)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Share leaderboard
                  </button>
                ) : null}
              </div>

              {isLoggedIn ? (
                <>
                  <form
                    onSubmit={handleAddFriend}
                    className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]"
                  >
                    <input
                      type="text"
                      value={friendUsername}
                      onChange={(e) => setFriendUsername(e.target.value)}
                      placeholder="Add friend by username"
                      className="rounded-2xl border border-white/10 bg-[#101b38] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />

                    <button
                      type="submit"
                      disabled={addingFriend}
                      className="rounded-2xl bg-[linear-gradient(135deg,#2563eb,#3b82f6)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {addingFriend ? "Adding..." : "Add friend"}
                    </button>
                  </form>

                  <p className="mt-3 text-xs text-slate-500">
                    Add friends by their LockdIn username.
                  </p>

                  {friendError ? (
                    <p className="mt-3 text-sm text-rose-300">{friendError}</p>
                  ) : null}

                  {friendSuccess ? (
                    <p className="mt-3 text-sm text-emerald-300">{friendSuccess}</p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLeaderboardMode("mostCooked")}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        leaderboardMode === "mostCooked"
                          ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Most Cooked
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardMode("biggestComeback")}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        leaderboardMode === "biggestComeback"
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Biggest Comeback
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardMode("mostLockedIn")}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        leaderboardMode === "mostLockedIn"
                          ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Most Locked In
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardMode("mostActive")}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        leaderboardMode === "mostActive"
                          ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Most Active
                    </button>
                  </div>

                  <div className="mt-5 rounded-[26px] border border-white/10 bg-[#0b1430]/80 p-2">
                    <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                      {leaderboardLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                          Loading leaderboard...
                        </div>
                      ) : sortedLeaderboard.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                          No one on the leaderboard yet. Add a friend by username to
                          start the chaos.
                        </div>
                      ) : (
                        sortedLeaderboard.map((entry, index) => (
                          <div
                            key={entry.id}
                            className={`rounded-3xl border p-4 ${getLeaderboardAccent(
                              entry.cookedScore
                            )} ${entry.isYou ? "ring-1 ring-blue-400/30" : ""}`}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    #{entry.rank}
                                  </span>

                                  {index === 0 ? (
                                    <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                                      <span className="inline-flex items-center gap-1">
                                        <Crown className="h-3 w-3" />
                                        Top
                                      </span>
                                    </span>
                                  ) : null}

                                  <p className="break-words text-base font-semibold text-white">
                                    @{entry.username}
                                  </p>

                                  {entry.isYou ? (
                                    <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-200">
                                      You
                                    </span>
                                  ) : null}

                                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    {entry.roastLabel}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm text-slate-400">
                                  {entry.course} • {entry.university}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    {entry.pendingTasks} active task
                                    {entry.pendingTasks === 1 ? "" : "s"}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    {entry.completionRate}% completion
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    {entry.streak} day streak
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    {entry.momentumLabel}
                                  </span>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                      entry.weeklyCookedChange < 0
                                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                        : entry.weeklyCookedChange > 0
                                        ? "border-rose-400/20 bg-rose-500/10 text-rose-300"
                                        : "border-white/10 bg-white/5 text-slate-300"
                                    }`}
                                  >
                                    7d cooked: {entry.weeklyCookedChange > 0 ? "+" : ""}
                                    {entry.weeklyCookedChange}
                                  </span>
                                </div>
                              </div>

                              <div className="text-left sm:text-right">
                                <p
                                  className={`text-3xl font-semibold sm:text-4xl ${getCookedTextColor(
                                    entry.cookedScore
                                  )}`}
                                >
                                  {entry.cookedScore}
                                </p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                  cooked score
                                </p>
                                <p className="mt-2 text-sm text-slate-300">
                                  {entry.status}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/20">
                              <div
                                className={`h-full rounded-full ${getCookedBarClass(
                                  entry.cookedScore
                                )}`}
                                style={{
                                  width: `${Math.max(6, entry.cookedScore)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                  Log in to start a cooked leaderboard with your friends.
                </div>
              )}
            </GlassCard>

            <div className="space-y-6">
              <GlassCard className={`p-5 sm:p-6 ${getCookedGlowClass(cooked.score)}`}>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Flame className="h-4 w-4 text-orange-300" />
                  Score Breakdown
                </div>

                <div className="mt-4 flex items-end gap-3">
                  <span
                    className={`text-5xl font-semibold ${getCookedTextColor(
                      cooked.score
                    )}`}
                  >
                    {loading ? "..." : cooked.score}
                  </span>
                  <span className="pb-2 text-xl text-slate-500">/100</span>
                </div>

                <p className="mt-2 text-base font-medium text-white">
                  {loading ? "Loading..." : cooked.status}
                </p>

                <ul className="mt-5 space-y-3">
                  {(loading ? ["Loading your risk factors..."] : cooked.reasons)
                    .slice(0, 4)
                    .map((reason) => (
                      <li
                        key={reason}
                        className="flex items-start gap-3 text-sm text-slate-200"
                      >
                        <span className="mt-2 h-2 w-2 rounded-full bg-blue-400" />
                        <span>{reason}</span>
                      </li>
                    ))}
                </ul>

                <div className="mt-6">
                  {bestRecoveryAction ? (
                    <Link
                      href={bestRecoveryAction.route}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#3b82f6)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
                    >
                      <Zap className="h-4 w-4" />
                      Reduce My Score
                    </Link>
                  ) : (
                    <Link
                      href="/tasks"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#3b82f6)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
                    >
                      Add a Task
                    </Link>
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-5 sm:p-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10">
                  <Share2 className="h-3.5 w-3.5" />
                  Shareable Moment
                </div>

                <h3 className="mt-4 text-2xl font-semibold text-white">
                  Your latest flex
                </h3>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Current snapshot
                  </p>
                  <h4 className="mt-2 text-2xl font-semibold text-white">
                    {getRoastLabel(cooked.score)}
                  </h4>
                  <p className="mt-2 text-sm text-slate-300">
                    You’re on {cooked.score}/100 with {stats.pending} active tasks and a{" "}
                    {profile ? profile.streak : 0}-day streak.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Score
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {cooked.score}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        XP
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {profile?.xp ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Streak
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {profile ? profile.streak : 0}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShareScore(cooked.score)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Share2 className="h-4 w-4" />
                    Share this
                  </button>
                </div>
              </GlassCard>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <GlassCard className="p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                    <Target className="h-3.5 w-3.5" />
                    Today
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                    What needs attention now
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Your most important work and the next things to move.
                  </p>
                </div>

                <Link
                  href="/performance"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Open dashboard
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-[#101b38] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Biggest Threat
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {loading
                          ? "Loading..."
                          : biggestThreat
                          ? biggestThreat.title
                          : "No immediate threats"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3">
                      <Shield className="h-5 w-5 text-rose-300" />
                    </div>
                  </div>

                  {loading ? (
                    <p className="mt-4 text-sm text-slate-400">
                      Loading your biggest risk...
                    </p>
                  ) : biggestThreat ? (
                    <>
                      <p className="mt-3 text-sm text-slate-400">
                        {biggestThreat.module}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
                            biggestThreat.priority
                          )}`}
                        >
                          {biggestThreat.priority}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {getUpcomingLabel(getDaysUntil(biggestThreat.dueDate))}
                        </span>
                      </div>

                      <Link
                        href="/tasks"
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#3b82f6)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
                      >
                        Go to tasks
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Clean board. Keep it that way.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#101b38] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Coach View
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {loading ? "Loading..." : coachTitle}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3">
                      <Sparkles className="h-5 w-5 text-blue-300" />
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {loading ? "Syncing your coach view..." : coachMessage}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/tasks"
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 transition hover:border-blue-400 hover:bg-[#122145]"
                    >
                      Open Tasks
                    </Link>
                    <Link
                      href="/planner"
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 transition hover:border-blue-400 hover:bg-[#122145]"
                    >
                      Build study plan
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-white/10 bg-[#101b38] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Today’s Focus
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      Top tasks to hit first
                    </p>
                  </div>
                  <Link
                    href="/tasks"
                    className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
                  >
                    Manage tasks
                  </Link>
                </div>

                <div className="mt-5 space-y-3">
                  {loading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                      Loading focus tasks...
                    </div>
                  ) : todayFocus.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                      No active tasks right now.
                    </div>
                  ) : (
                    todayFocus.map((task, index) => (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Focus {index + 1}
                            </p>
                            <p className="mt-2 break-words text-base font-medium text-white">
                              {task.title}
                            </p>
                            <p className="mt-2 text-sm text-slate-400">{task.module}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
                                task.priority
                              )}`}
                            >
                              {task.priority}
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                              {getUpcomingLabel(getDaysUntil(task.dueDate))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </GlassCard>

            <div className="space-y-6">
              <GlassCard className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">
                      <BookOpen className="h-3.5 w-3.5" />
                      Planner Sync
                    </div>
                    <h3 className="mt-4 text-xl font-semibold sm:text-2xl">
                      Today’s Study Plan
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Your saved blocks for today, now matched more reliably.
                    </p>
                  </div>
                  <Link
                    href="/planner"
                    className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
                  >
                    Open planner
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Today
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {studyBlocksLoading ? "..." : todaysStudyBlocks.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Completed
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {studyBlocksLoading
                        ? "..."
                        : todaysStudyBlocks.filter((block) => block.completed).length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Planned
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {studyBlocksLoading
                        ? "..."
                        : todaysStudyBlocks
                            .filter((block) => !block.completed)
                            .reduce(
                              (sum, block) => sum + Number(block.durationMinutes ?? 0),
                              0
                            )}
                      {studyBlocksLoading ? "" : "m"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {studyBlocksLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                      Loading today’s plan...
                    </div>
                  ) : todaysStudyBlocks.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                      No study blocks matched today yet. If your planner has blocks, this
                      home page now checks full day names, short day names, and even date
                      values more reliably.
                    </div>
                  ) : (
                    todaysStudyBlocks.map((block, index) => (
                      <div
                        key={`${block.id}-${index}`}
                        className={`rounded-2xl border p-4 ${
                          block.completed
                            ? "border-emerald-400/15 bg-emerald-500/[0.06]"
                            : "border-white/10 bg-[#101b38]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p
                              className={`text-base font-medium ${
                                block.completed ? "text-slate-400 line-through" : "text-white"
                              }`}
                            >
                              {block.subject}
                            </p>
                            <p className="mt-2 text-sm text-slate-400">
                              {block.focus}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                {block.location || "Study session"}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                {block.durationMinutes} mins
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-xs ${
                                  block.completed
                                    ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                    : "border border-blue-400/20 bg-blue-500/10 text-blue-300"
                                }`}
                              >
                                {block.completed ? "Completed" : "Planned"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">{block.time}</p>
                            <p className="mt-1 text-xs text-slate-500">{block.day}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold sm:text-2xl">Quick Access</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Jump straight to the parts of LockdIn you use most.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                    Move faster
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Link
                    href="/tasks"
                    className="rounded-2xl border border-white/10 bg-[#101b38] p-5 transition hover:border-blue-400 hover:bg-[#122145]"
                  >
                    <p className="text-lg font-medium">Tasks</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Add work, manage deadlines, and update progress.
                    </p>
                  </Link>

                  <Link
                    href="/planner"
                    className="rounded-2xl border border-white/10 bg-[#101b38] p-5 transition hover:border-blue-400 hover:bg-[#122145]"
                  >
                    <p className="text-lg font-medium">Planner</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Turn your workload into realistic study blocks.
                    </p>
                  </Link>

                  <Link
                    href="/performance"
                    className="rounded-2xl border border-white/10 bg-[#101b38] p-5 transition hover:border-blue-400 hover:bg-[#122145]"
                  >
                    <p className="text-lg font-medium">Performance</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Track pressure, momentum, and what to fix next.
                    </p>
                  </Link>

                  <Link
                    href="/badges"
                    className="rounded-2xl border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(15,23,42,0.95))] p-5 transition hover:border-amber-400 hover:bg-[linear-gradient(135deg,rgba(251,191,36,0.24),rgba(15,23,42,1))]"
                  >
                    <p className="text-lg font-medium text-white">Badges</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Track your milestones, streaks, and progress achievements.
                    </p>
                  </Link>

                  <Link
                    href="/degree-tracker"
                    className="group relative overflow-hidden rounded-2xl border border-blue-400/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(15,23,42,0.95))] p-5 transition hover:border-blue-400 hover:bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(15,23,42,1))] md:col-span-2"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-400/10 blur-2xl transition group-hover:bg-blue-400/20" />
                    <div className="relative">
                      <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                        New
                      </div>
                      <p className="mt-3 text-lg font-medium text-white">
                        Degree Tracker
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Track overall progress, see how far through your degree you
                        are, and stay motivated with the bigger picture.
                      </p>
                      <p className="mt-4 text-sm font-medium text-blue-300 transition group-hover:text-blue-200">
                        Open degree tracker →
                      </p>
                    </div>
                  </Link>
                </div>
              </GlassCard>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <GlassCard className="p-5 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold sm:text-2xl">Recent Tasks</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Your latest task activity and deadlines.
                  </p>
                </div>
                <Link
                  href="/tasks"
                  className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
                >
                  View all
                </Link>
              </div>

              <div className="mt-6 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    Loading recent tasks...
                  </div>
                ) : stats.recent.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    No tasks yet. Add your first task to get started.
                  </div>
                ) : (
                  stats.recent.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-[#101b38] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p
                            className={`break-words text-base font-medium ${
                              task.completed ? "text-slate-500 line-through" : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-400">{task.module}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <Clock3 className="h-4 w-4" />
                            <span>Due: {task.dueDate}</span>
                          </div>
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold sm:text-2xl">Momentum Panel</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Your study rhythm, planner consistency, and current position.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                  Live summary
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3">
                      <TimerReset className="h-5 w-5 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Planner completion</p>
                      <p className="text-2xl font-semibold text-white">
                        {stats.plannerCompletionRate}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Completed blocks</p>
                      <p className="text-2xl font-semibold text-white">
                        {stats.completedStudyBlocks}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                      <TrendingUp className="h-5 w-5 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Open study blocks</p>
                      <p className="text-2xl font-semibold text-white">
                        {stats.openStudyBlocks}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
                      <Star className="h-5 w-5 text-fuchsia-300" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Best next move</p>
                      <p className="text-base font-semibold text-white">
                        {bestRecoveryAction?.label ?? "Stay consistent"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {stats.nextTask ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(59,130,246,0.14),rgba(15,23,42,0.95))] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Next deadline
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {stats.nextTask.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {stats.nextTask.module} •{" "}
                    {getUpcomingLabel(getDaysUntil(stats.nextTask.dueDate))}
                  </p>
                </div>
              ) : null}
            </GlassCard>
          </section>

          {isLoadingPage ? (
            <section className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
              Loading LockdIn...
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}