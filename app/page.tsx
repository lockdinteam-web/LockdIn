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

const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";

function getDaysUntil(dateString: string) {
  const today = new Date();
  const due = new Date(dateString);

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
  if (score <= 20) return "shadow-[0_0_40px_rgba(16,185,129,0.18)]";
  if (score <= 40) return "shadow-[0_0_40px_rgba(132,204,22,0.18)]";
  if (score <= 60) return "shadow-[0_0_40px_rgba(245,158,11,0.18)]";
  if (score <= 80) return "shadow-[0_0_40px_rgba(249,115,22,0.18)]";
  return "shadow-[0_0_40px_rgba(244,63,94,0.18)]";
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
  if (score >= 85) return "border-rose-400/30 bg-rose-500/10";
  if (score >= 65) return "border-orange-400/30 bg-orange-500/10";
  if (score >= 40) return "border-amber-400/30 bg-amber-500/10";
  return "border-emerald-400/30 bg-emerald-500/10";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function upsertTodayLeaderboardSnapshotClient(
  userId: string,
  tasks: HomeTask[]
) {
  const cookedResult = calculateCookedScore(tasks, []);
  const pendingTasks = tasks.filter((task) => !task.completed).length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const today = getTodayDate();

  const { error: snapshotError } = await supabase
    .from("leaderboard_snapshots")
    .upsert(
      {
        user_id: userId,
        snapshot_date: today,
        cooked_score: cookedResult.score,
        pending_tasks: pendingTasks,
        completed_tasks: completedTasks,
        completion_rate: completionRate,
      },
      {
        onConflict: "user_id,snapshot_date",
      }
    );

  if (snapshotError) {
    console.error("Error upserting leaderboard snapshot:", snapshotError.message);
  }

  const { error: activityError } = await supabase
    .from("user_activity_days")
    .upsert(
      {
        user_id: userId,
        activity_date: today,
      },
      {
        onConflict: "user_id,activity_date",
      }
    );

  if (activityError) {
    console.error("Error upserting activity day:", activityError.message);
  }
}

export default function HomePage() {
  const router = useRouter();
  const { tasks: providerTasks, loading } = useTasks();

  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([]);
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
          "user_id, snapshot_date, cooked_score, pending_tasks, completed_tasks, completion_rate"
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
        const cookedResult = calculateCookedScore(personTasks, []);
        const pendingTasks = personTasks.filter((task) => !task.completed).length;
        const completedTasks = personTasks.filter((task) => task.completed).length;
        const completionRate =
          personTasks.length > 0
            ? Math.round((completedTasks / personTasks.length) * 100)
            : 0;

        const personSnapshots = (snapshotsByUser.get(person.id) ?? []).sort((a, b) =>
          a.snapshot_date.localeCompare(b.snapshot_date)
        );

        const oldestSnapshot = personSnapshots[0] ?? null;

        const weeklyCookedChange = oldestSnapshot
          ? cookedResult.score - oldestSnapshot.cooked_score
          : 0;

        const weeklyPendingChange = oldestSnapshot
          ? pendingTasks - oldestSnapshot.pending_tasks
          : 0;

        const streak = calculateStreak(activityByUser.get(person.id) ?? []);

        return {
          id: person.id,
          username: person.username,
          university: person.university,
          course: person.course,
          cookedScore: cookedResult.score,
          status: cookedResult.status,
          pendingTasks,
          completedTasks,
          completionRate,
          weeklyCookedChange,
          weeklyPendingChange,
          streak,
          rank: 0,
          isYou: person.id === userId,
          momentumLabel: getMomentumLabel(completionRate, pendingTasks),
          roastLabel: getRoastLabel(cookedResult.score),
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

    const cleanUsername = friendUsername.trim().replace(/^@/, "");

    if (!cleanUsername) {
      setFriendError("Enter a username first.");
      return;
    }

    try {
      setAddingFriend(true);
      setFriendError("");
      setFriendSuccess("");

      const { data: foundUser, error: findError } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", cleanUsername)
        .maybeSingle();

      if (findError) {
        console.error("Could not search for username:", findError);
        setFriendError(findError.message || "Could not search for that username.");
        return;
      }

      if (!foundUser) {
        setFriendError("No user found with that username.");
        return;
      }

      if (foundUser.id === currentUserId) {
        setFriendError("You cannot add yourself.");
        return;
      }

      const { data: existingConnection, error: existingError } = await supabase
        .from("friend_connections")
        .select("user_id, friend_id")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${foundUser.id}),and(user_id.eq.${foundUser.id},friend_id.eq.${currentUserId})`
        )
        .maybeSingle();

      if (existingError) {
        console.error("Could not check existing connections:", existingError);
        setFriendError(
          existingError.message || "Could not check existing connections."
        );
        return;
      }

      if (existingConnection) {
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
    setStudyBlocks(
      safeParseArray<StudyBlock>(localStorage.getItem(STUDY_PLAN_STORAGE_KEY))
    );

    async function checkAuthAndProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);
      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setProfile(null);
        setLeaderboard([]);
        setLeaderboardLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, university, course")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileData) {
        router.push("/onboarding");
        return;
      }

      setProfile(profileData);
      await loadLeaderboard(user.id);
    }

    checkAuthAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setIsLoggedIn(!!user);
      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setProfile(null);
        setLeaderboard([]);
        setLeaderboardLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, university, course")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileData) {
        router.push("/onboarding");
        return;
      }

      setProfile(profileData);
      await loadLeaderboard(user.id);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const tasks = useMemo<HomeTask[]>(() => {
    return ((providerTasks ?? []) as any[]).map((task) => ({
      id: task.id,
      title: task.title,
      module: task.module,
      dueDate: task.dueDate ?? task.due_date ?? "",
      priority: task.priority,
      completed: task.completed,
    }));
  }, [providerTasks]);

  useEffect(() => {
    async function syncMySnapshot() {
      if (!currentUserId || loading) return;

      const leaderboardTasks = tasks.map((task) => ({
        id: task.id,
        title: task.title,
        module: task.module,
        dueDate: task.dueDate,
        priority: task.priority,
        completed: task.completed,
      }));

      await upsertTodayLeaderboardSnapshotClient(currentUserId, leaderboardTasks);
    }

    syncMySnapshot();
  }, [currentUserId, tasks, loading]);

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
        (studyBlocks.reduce((sum, block) => sum + block.durationMinutes, 0) / 60) *
          10
      ) / 10;

    const plannerCompletionRate =
      studyBlocks.length > 0
        ? Math.round((completedStudyBlocks / studyBlocks.length) * 100)
        : 0;

    const recent = [...tasks].slice(0, 4);

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_24%)]" />

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#08122b_0%,#061021_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8 md:p-10">
            <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
              <div className="max-w-3xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 sm:text-sm">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    Built for students who need to lock in
                  </div>

                  {isLoggedIn && profile ? (
                    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
                        {profile.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">
                          @{profile.username}
                        </p>
                        <p className="text-xs text-slate-400">
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

                <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl xl:text-6xl">
                  Your academic command centre.
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  Deadlines, focus, momentum, and social pressure — all in one
                  place, so you always know what matters next.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Active Tasks
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {loading ? "..." : stats.pending}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Due This Week
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {loading ? "..." : stats.dueThisWeek}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Planned Hours
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {stats.studyHours}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/tasks"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
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

              <div
                className={`relative rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6 ${getCookedGlowClass(
                  cooked.score
                )}`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_45%)]" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
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
                    {loading ? "Loading your dashboard..." : getHeroSubtitle(cooked.score)}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
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

                  <div className="mt-6 rounded-[22px] border border-white/10 bg-white p-4">
                    <Image
                      src="/logo.png"
                      alt="LockdIn logo"
                      width={260}
                      height={260}
                      className="mx-auto h-auto w-[150px] object-contain sm:w-[185px]"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-400/20">
                    <Trophy className="h-3.5 w-3.5" />
                    Social Pressure
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                    🔥 Cooked Leaderboard
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
                      className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {addingFriend ? "Adding..." : "Add friend"}
                    </button>
                  </form>

                  <p className="mt-3 text-xs text-slate-500">
                    Add friends by their LockdIn username. You only need to add them once.
                  </p>

                  {friendError ? (
                    <p className="mt-3 text-sm text-rose-300">{friendError}</p>
                  ) : null}

                  {friendSuccess ? (
                    <p className="mt-3 text-sm text-emerald-300">{friendSuccess}</p>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-2">
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

                  <div className="mt-6 space-y-4">
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
                      sortedLeaderboard.slice(0, 5).map((entry, index) => (
                        <div
                          key={entry.id}
                          className={`rounded-2xl border p-4 sm:p-5 ${getLeaderboardAccent(
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
                              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
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
                </>
              ) : (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                  Log in to start a cooked leaderboard with your friends.
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div
                className={`rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-6 ${getCookedGlowClass(
                  cooked.score
                )}`}
              >
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

                <p className="mt-2 text-sm text-slate-400">
                  {loading
                    ? "Loading your score..."
                    : getMotivationLine(cooked.score, stats.pending, stats.overdue)}
                </p>

                <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getCookedBarClass(
                      cooked.score
                    )}`}
                    style={{
                      width: `${Math.max(6, loading ? 6 : cooked.score)}%`,
                    }}
                  />
                </div>

                <ul className="mt-5 space-y-3">
                  {(loading ? ["Loading your risk factors..."] : cooked.reasons).map(
                    (reason) => (
                      <li
                        key={reason}
                        className="flex items-start gap-3 text-sm text-slate-200"
                      >
                        <span className="mt-2 h-2 w-2 rounded-full bg-blue-400" />
                        <span>{reason}</span>
                      </li>
                    )
                  )}
                </ul>

                <div className="mt-6">
                  {bestRecoveryAction ? (
                    <Link
                      href={bestRecoveryAction.route}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                    >
                      <Zap className="h-4 w-4" />
                      Reduce My Score
                    </Link>
                  ) : (
                    <Link
                      href="/tasks"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                    >
                      Add a Task
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                  <Target className="h-3.5 w-3.5" />
                  AI Coach
                </div>

                <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                  {loading ? "Loading..." : coachTitle}
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {loading ? "Syncing your coach view..." : coachMessage}
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-[#101b38] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Recommended next step
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white">
                    {loading
                      ? "Loading recommendation..."
                      : stats.overdue > 0
                      ? "Open Tasks and complete the most overdue item first."
                      : stats.highPriority > 0
                      ? "Finish your next high-priority task before switching context."
                      : stats.pending > 0
                      ? "Use Planner to assign focused time to your remaining workload."
                      : "Use Planner to map out your next study block while you’re ahead."}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/tasks"
                    className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200 transition hover:border-blue-400 hover:bg-[#122145]"
                  >
                    Open Tasks
                  </Link>
                  <Link
                    href="/planner"
                    className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200 transition hover:border-blue-400 hover:bg-[#122145]"
                  >
                    Build study plan
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Biggest Threat</h3>
                <Link
                  href="/performance"
                  className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
                >
                  Open dashboard
                </Link>
              </div>

              {loading ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#101b38] p-5 text-slate-300 sm:p-6">
                  Loading your biggest threat...
                </div>
              ) : biggestThreat ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#101b38] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold break-words">
                        {biggestThreat.title}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        {biggestThreat.module}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
                        biggestThreat.priority
                      )}`}
                    >
                      {biggestThreat.priority}
                    </span>
                  </div>

                  <p className="mt-5 text-sm text-slate-300">
                    Due {biggestThreat.dueDate}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    {getUpcomingLabel(getDaysUntil(biggestThreat.dueDate))}
                  </p>

                  <Link
                    href="/tasks"
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                  >
                    Go to tasks
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#101b38] p-5 text-slate-300 sm:p-6">
                  No immediate threats right now. That is a very nice position to be in.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Today’s Focus</h3>
                <Link
                  href="/tasks"
                  className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
                >
                  Manage tasks
                </Link>
              </div>

              <div className="mt-6 space-y-4">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    Loading focus tasks...
                  </div>
                ) : todayFocus.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    No active tasks right now. That board is looking clean.
                  </div>
                ) : (
                  todayFocus.map((task, index) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-[#101b38] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Focus {index + 1}
                          </p>
                          <p className="mt-2 break-words text-base font-medium text-white">
                            {task.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-400">{task.module}</p>
                          <p className="mt-2 text-sm text-slate-500">
                            {getUpcomingLabel(getDaysUntil(task.dueDate))}
                          </p>
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
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Recent Tasks</h3>
                <Link
                  href="/tasks"
                  className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
                >
                  View all
                </Link>
              </div>

              <div className="mt-6 space-y-4">
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
                      className="rounded-2xl border border-white/10 bg-[#101b38] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p
                            className={`break-words text-base font-medium ${
                              task.completed
                                ? "text-slate-500 line-through"
                                : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-400">{task.module}</p>
                          <p className="mt-2 text-sm text-slate-500">
                            Due: {task.dueDate}
                          </p>
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
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Quick Access</h3>
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
                  href="/degree-tracker"
                  className="group relative overflow-hidden rounded-2xl border border-blue-400/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(15,23,42,0.95))] p-5 transition hover:border-blue-400 hover:bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(15,23,42,1))]"
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
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}