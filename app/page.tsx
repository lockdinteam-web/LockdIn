"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/components/TasksProvider";
import { supabase } from "@/lib/supabase";
import {
  calculateCookedScore,
  getBestRecoveryAction,
  type StudyBlock,
} from "@/lib/calculateCookedScore";

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

type LeaderboardMode =
  | "mostCooked"
  | "biggestComeback"
  | "mostLockedIn"
  | "mostActive";

type LeaderboardSnapshot = Record<
  string,
  {
    cookedScore: number;
    pendingTasks: number;
    lastSeenAt: string;
  }
>;

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
  rank: number;
  isYou: boolean;
  changeSinceLastCheck: number;
  pendingChangeSinceLastCheck: number;
  momentumLabel: string;
  roastLabel: string;
};

const STUDY_PLAN_STORAGE_KEY = "lockdin_study_plan";
const LEADERBOARD_SNAPSHOT_KEY = "lockdin_leaderboard_snapshot_v1";

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

function safeParseObject<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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

function mapDatabaseTask(task: DatabaseTask): HomeTask {
  return {
    id: task.id,
    title: task.title,
    module: task.module,
    dueDate: task.due_date,
    priority: task.priority,
    completed: task.completed,
  };
}

function getLeaderboardAccent(score: number) {
  if (score >= 85) return "border-rose-400/30 bg-rose-500/10";
  if (score >= 65) return "border-orange-400/30 bg-orange-500/10";
  if (score >= 40) return "border-amber-400/30 bg-amber-500/10";
  return "border-emerald-400/30 bg-emerald-500/10";
}

function getDeltaPill(delta: number) {
  if (delta < 0) {
    return {
      text: `${delta}`,
      className:
        "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
      label: "Recovered",
    };
  }
  if (delta > 0) {
    return {
      text: `+${delta}`,
      className: "border-rose-400/20 bg-rose-500/10 text-rose-300",
      label: "More cooked",
    };
  }
  return {
    text: "0",
    className: "border-white/10 bg-white/5 text-slate-300",
    label: "No change",
  };
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
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

      const previousSnapshot = safeParseObject<LeaderboardSnapshot>(
        localStorage.getItem(LEADERBOARD_SNAPSHOT_KEY),
        {}
      );

      const { data: connectionRows, error: connectionError } = await supabase
        .from("friend_connections")
        .select("user_id, friend_id")
        .eq("user_id", userId);

      if (connectionError) {
        console.error("Error loading friend connections:", connectionError.message);
        setLeaderboard([]);
        return;
      }

      const friendIds =
        (connectionRows as FriendConnection[] | null)?.map(
          (row) => row.friend_id
        ) ?? [];

      const allIds = Array.from(new Set([userId, ...friendIds]));

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, university, course")
        .in("id", allIds);

      if (profileError) {
        console.error("Error loading leaderboard profiles:", profileError.message);
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

      const tasksByUser = new Map<string, HomeTask[]>();

      ((taskRows as DatabaseTask[] | null) ?? []).forEach((task) => {
        const mapped = mapDatabaseTask(task);
        const existing = tasksByUser.get(task.user_id) ?? [];
        existing.push(mapped);
        tasksByUser.set(task.user_id, existing);
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

        const oldSnapshot = previousSnapshot[person.id];
        const changeSinceLastCheck = oldSnapshot
          ? cookedResult.score - oldSnapshot.cookedScore
          : 0;

        const pendingChangeSinceLastCheck = oldSnapshot
          ? pendingTasks - oldSnapshot.pendingTasks
          : 0;

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
          rank: 0,
          isYou: person.id === userId,
          changeSinceLastCheck,
          pendingChangeSinceLastCheck,
          momentumLabel: getMomentumLabel(completionRate, pendingTasks),
          roastLabel: getRoastLabel(cookedResult.score),
        };
      });

      const newSnapshot: LeaderboardSnapshot = {};
      entries.forEach((entry) => {
        newSnapshot[entry.id] = {
          cookedScore: entry.cookedScore,
          pendingTasks: entry.pendingTasks,
          lastSeenAt: new Date().toISOString(),
        };
      });

      localStorage.setItem(LEADERBOARD_SNAPSHOT_KEY, JSON.stringify(newSnapshot));
      setLeaderboard(entries);
    } catch (error) {
      console.error("Unexpected leaderboard error:", error);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  async function handleAddFriend(e: React.FormEvent<HTMLFormElement>) {
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
        .eq("username", cleanUsername)
        .maybeSingle();

      if (findError) {
        setFriendError("Could not search for that username.");
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
        .eq("user_id", currentUserId)
        .eq("friend_id", foundUser.id)
        .maybeSingle();

      if (existingError) {
        setFriendError("Could not check existing connections.");
        return;
      }

      if (existingConnection) {
        setFriendError("That friend is already on your leaderboard.");
        return;
      }

      const { error: insertError } = await supabase
        .from("friend_connections")
        .insert([
          { user_id: currentUserId, friend_id: foundUser.id },
          { user_id: foundUser.id, friend_id: currentUserId },
        ]);

      if (insertError) {
        setFriendError("Could not add that friend.");
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
    const lines = entries.slice(0, 5).map(
      (entry, index) =>
        `${index + 1}. @${entry.username} — ${entry.cookedScore}/100`
    );

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
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

    const nextTask = upcoming[0] ?? null;

    const completionRate =
      tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    const completedStudyBlocks = studyBlocks.filter(
      (block) => block.completed
    ).length;
    const openStudyBlocks = studyBlocks.filter(
      (block) => !block.completed
    ).length;

    const studyHours =
      Math.round(
        (studyBlocks.reduce((sum, block) => sum + block.durationMinutes, 0) / 60) *
          10
      ) / 10;

    const plannerCompletionRate =
      studyBlocks.length > 0
        ? Math.round((completedStudyBlocks / studyBlocks.length) * 100)
        : 0;

    const recent = [...tasks].slice(0, 5);

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
          (aDays < 0
            ? 100
            : aDays === 0
            ? 80
            : aDays === 1
            ? 65
            : aDays <= 3
            ? 45
            : 20) +
          (a.priority === "High" ? 25 : a.priority === "Medium" ? 15 : 8);

        const bScore =
          (bDays < 0
            ? 100
            : bDays === 0
            ? 80
            : bDays === 1
            ? 65
            : bDays <= 3
            ? 45
            : 20) +
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
          (aDays < 0
            ? 100
            : aDays === 0
            ? 90
            : aDays === 1
            ? 75
            : aDays <= 3
            ? 55
            : 20) +
          (a.priority === "High" ? 30 : a.priority === "Medium" ? 18 : 8);

        const bValue =
          (bDays < 0
            ? 100
            : bDays === 0
            ? 90
            : bDays === 1
            ? 75
            : bDays <= 3
            ? 55
            : 20) +
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
          if (a.changeSinceLastCheck !== b.changeSinceLastCheck) {
            return a.changeSinceLastCheck - b.changeSinceLastCheck;
          }
          return a.cookedScore - b.cookedScore;
        })
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    if (leaderboardMode === "mostLockedIn") {
      return cloned
        .sort((a, b) => {
          if (a.cookedScore !== b.cookedScore) return a.cookedScore - b.cookedScore;
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
      if (top.changeSinceLastCheck < 0) {
        return `@${top.username} has made the best comeback since the last check.`;
      }
      return `Nobody has recovered yet. Chaos remains unchanged.`;
    }
    if (leaderboardMode === "mostLockedIn") {
      return `@${top.username} is currently the least cooked.`;
    }
    return `@${top.username} is carrying the heaviest active workload.`;
  }, [sortedLeaderboard, leaderboardMode]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="space-y-5 sm:space-y-8">
          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(244,63,94,0.12),_transparent_25%),linear-gradient(180deg,#08122b_0%,#061021_100%)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:rounded-[32px] sm:p-8 md:p-10">
            <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
              <div className="max-w-3xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 sm:px-4 sm:text-sm">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
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

                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:mt-6 sm:text-4xl md:text-5xl xl:text-6xl">
                  Study smarter. Stay organised. Know how cooked you are.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:mt-5 sm:text-base sm:leading-8 md:text-lg">
                  LockdIn turns your tasks, deadlines, and study blocks into one
                  clear academic command centre — so you always know what matters
                  next.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                    {loading
                      ? "Loading tasks..."
                      : `${stats.pending} active task${
                          stats.pending === 1 ? "" : "s"
                        }`}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                    {loading ? "Loading..." : `${stats.dueThisWeek} due this week`}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                    {stats.studyHours} planned hours
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:gap-4">
                  <Link
                    href="/tasks"
                    className="w-full rounded-2xl bg-blue-500 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-blue-400 sm:w-auto"
                  >
                    Add a task
                  </Link>
                  <Link
                    href="/planner"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    Open planner
                  </Link>
                  <Link
                    href="/performance"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    View performance
                  </Link>
                  <Link
                    href="/degree-tracker"
                    className="w-full rounded-2xl border border-blue-400/20 bg-blue-500/10 px-6 py-3 text-center text-sm font-medium text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20 sm:w-auto"
                  >
                    Open degree tracker
                  </Link>
                </div>

                {shareMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {shareMessage}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-64 w-64 rounded-full bg-blue-500/10 blur-3xl sm:h-80 sm:w-80" />
                </div>

                <div
                  className={`relative rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-5 ${getCookedGlowClass(
                    cooked.score
                  )}`}
                >
                  <div className="grid gap-4">
                    <div className="rounded-[24px] border border-white/10 bg-[#0d1730] p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Live cooked score
                          </p>
                          <div className="mt-3 flex items-end gap-3">
                            <span
                              className={`text-5xl font-semibold sm:text-6xl ${getCookedTextColor(
                                cooked.score
                              )}`}
                            >
                              {loading ? "..." : cooked.score}
                            </span>
                            <span className="pb-2 text-xl text-slate-500">/100</span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-white">
                            {loading ? "Loading..." : getCookedZone(cooked.score)}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
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

                      <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getCookedBarClass(
                            cooked.score
                          )}`}
                          style={{
                            width: `${Math.max(8, loading ? 8 : cooked.score)}%`,
                          }}
                        />
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        {loading ? "Loading your dashboard..." : getHeroSubtitle(cooked.score)}
                      </p>

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
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-[#101b38] p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          Next move
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {loading
                            ? "Loading..."
                            : bestRecoveryAction
                            ? bestRecoveryAction.label
                            : "You’re currently clear"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#101b38] p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          Momentum
                        </p>
                        <p className="mt-2 text-sm font-medium text-blue-300">
                          {loading
                            ? "Loading..."
                            : stats.completionRate >= 80
                            ? "Strong"
                            : stats.completionRate >= 50
                            ? "Building"
                            : "Needs work"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-white p-4">
                      <Image
                        src="/logo.png"
                        alt="LockdIn logo"
                        width={260}
                        height={260}
                        className="mx-auto h-auto w-[150px] object-contain sm:w-[190px]"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Total tasks</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">
                {loading ? "..." : tasks.length}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Completed</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">
                {loading ? "..." : stats.completed}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Urgent</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">
                {loading ? "..." : stats.urgent}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-6">
              <p className="text-sm text-slate-400">Completion rate</p>
              <p className="mt-3 text-3xl font-semibold sm:text-4xl">
                {loading ? "..." : `${stats.completionRate}%`}
              </p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10">
                    How Cooked Am I?
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Academic Risk Score
                  </h2>

                  <div className="mt-5 flex items-end gap-3">
                    <span
                      className={`text-5xl font-semibold sm:text-6xl ${getCookedTextColor(
                        cooked.score
                      )}`}
                    >
                      {loading ? "..." : cooked.score}
                    </span>
                    <span className="pb-2 text-xl text-slate-500">/100</span>
                  </div>

                  <p className="mt-3 text-lg font-medium text-white">
                    Status: {loading ? "Loading..." : cooked.status}
                  </p>

                  <p className="mt-2 text-sm uppercase tracking-[0.2em] text-slate-500">
                    {loading ? "..." : getRoastLabel(cooked.score)}
                  </p>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                    {loading ? "Loading your score..." : cooked.headline}
                  </p>

                  <p className="mt-3 text-sm text-slate-400">
                    {loading
                      ? "Syncing your dashboard..."
                      : getMotivationLine(cooked.score, stats.pending, stats.overdue)}
                  </p>

                  <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getCookedBarClass(
                        cooked.score
                      )}`}
                      style={{
                        width: `${Math.max(6, loading ? 6 : cooked.score)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="w-full max-w-[320px] rounded-3xl border border-white/10 bg-[#101b38] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    What’s driving it
                  </p>

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

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Fastest recovery move
                    </p>

                    {loading ? (
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        Loading your best move...
                      </p>
                    ) : bestRecoveryAction ? (
                      <>
                        <p className="mt-3 text-sm leading-7 text-white">
                          {bestRecoveryAction.label}
                        </p>
                        <p className="mt-2 text-sm text-blue-300">
                          Potential score drop: -{bestRecoveryAction.scoreDrop}
                        </p>

                        <Link
                          href={bestRecoveryAction.route}
                          className="mt-4 inline-flex w-full justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                        >
                          Reduce My Score
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                          You have no active recovery moves right now.
                        </p>

                        <Link
                          href="/tasks"
                          className="mt-4 inline-flex w-full justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
                        >
                          Add a Task
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
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
                    className="mt-6 inline-flex w-full justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400 sm:w-auto"
                  >
                    Go to tasks
                  </Link>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#101b38] p-5 text-slate-300 sm:p-6">
                  No immediate threats right now. That is a very nice position to be in.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-400/20">
                    AI Coach
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {loading ? "Loading..." : coachTitle}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                    {loading ? "Syncing your coach view..." : coachMessage}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:min-w-[240px]">
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
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
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
                <Link
                  href="/performance"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 text-sm text-slate-200 transition hover:border-blue-400 hover:bg-[#122145]"
                >
                  Review performance
                </Link>
                <Link
                  href="/degree-tracker"
                  className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
                >
                  Open degree tracker
                </Link>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <h3 className="text-xl font-semibold sm:text-2xl">Study Signals</h3>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-4">
                  <p className="text-sm text-slate-400">Planned hours</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.studyHours}h</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-4">
                  <p className="text-sm text-slate-400">Open study blocks</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {stats.openStudyBlocks}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-4">
                  <p className="text-sm text-slate-400">Planner completion</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {stats.plannerCompletionRate}%
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_1fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Today’s Focus</h3>
                <Link
                  href="/tasks"
                  className="shrink-0 text-sm font-medium text-blue-400 transition hover:text-blue-300"
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

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Quick Access</h3>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                  Move faster
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <Link
                  href="/tasks"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 transition hover:border-blue-400 hover:bg-[#122145] sm:p-5"
                >
                  <p className="text-lg font-medium">Tasks</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Add work, manage deadlines, and update progress.
                  </p>
                </Link>

                <Link
                  href="/planner"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 transition hover:border-blue-400 hover:bg-[#122145] sm:p-5"
                >
                  <p className="text-lg font-medium">Planner</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Turn your workload into realistic study blocks.
                  </p>
                </Link>

                <Link
                  href="/performance"
                  className="rounded-2xl border border-white/10 bg-[#101b38] p-4 transition hover:border-blue-400 hover:bg-[#122145] sm:p-5"
                >
                  <p className="text-lg font-medium">Performance</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Track pressure, momentum, and what to fix next.
                  </p>
                </Link>

                <Link
                  href="/degree-tracker"
                  className="group relative overflow-hidden rounded-2xl border border-blue-400/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(15,23,42,0.95))] p-4 transition hover:border-blue-400 hover:bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(15,23,42,1))] sm:p-5"
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

          <section className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold sm:text-2xl">
                    🔥 Cooked Leaderboard
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {leaderboardHeadline}
                  </p>
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
                    className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
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
                      sortedLeaderboard.map((entry) => {
                        const delta = getDeltaPill(entry.changeSinceLastCheck);

                        return (
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
                                    {entry.momentumLabel}
                                  </span>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs ${delta.className}`}
                                  >
                                    {delta.label}: {delta.text}
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
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                  Log in to start a cooked leaderboard with your friends.
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Quick Wins</h3>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                  Fastest score drops
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    Loading quick wins...
                  </div>
                ) : bestRecoveryAction ? (
                  <>
                    <Link
                      href={bestRecoveryAction.route}
                      className="block rounded-2xl border border-white/10 bg-[#101b38] p-5 transition hover:border-blue-400 hover:bg-[#122145]"
                    >
                      <p className="text-lg font-medium text-white">
                        {bestRecoveryAction.label}
                      </p>
                      <p className="mt-2 text-sm text-blue-300">
                        Reduce cooked score by {bestRecoveryAction.scoreDrop}
                      </p>
                    </Link>

                    <Link
                      href="/planner"
                      className="block rounded-2xl border border-white/10 bg-[#101b38] p-5 transition hover:border-blue-400 hover:bg-[#122145]"
                    >
                      <p className="text-lg font-medium text-white">
                        Complete your next study block
                      </p>
                      <p className="mt-2 text-sm text-emerald-300">
                        Boost momentum and consistency
                      </p>
                    </Link>

                    <Link
                      href="/tasks"
                      className="block rounded-2xl border border-white/10 bg-[#101b38] p-5 transition hover:border-blue-400 hover:bg-[#122145]"
                    >
                      <p className="text-lg font-medium text-white">
                        Clear one urgent task
                      </p>
                      <p className="mt-2 text-sm text-amber-300">
                        Remove deadline pressure fast
                      </p>
                    </Link>
                  </>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5 text-slate-300">
                    You’re in a strong position right now. No urgent quick wins
                    needed.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid items-start gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:gap-6">
            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold sm:text-2xl">Recent Tasks</h3>
                <Link
                  href="/tasks"
                  className="shrink-0 text-sm font-medium text-blue-400 transition hover:text-blue-300"
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

            <div className="rounded-[24px] border border-white/10 bg-[#08122b] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:rounded-[28px] sm:p-8">
              <h3 className="text-xl font-semibold sm:text-2xl">Leaderboard Notes</h3>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <p className="text-sm text-slate-400">How it ranks</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    You can switch between Most Cooked, Biggest Comeback, Most
                    Locked In, and Most Active.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <p className="text-sm text-slate-400">Movement tracking</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    Comeback movement is tracked from the last time this browser
                    loaded the leaderboard.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#101b38] p-5">
                  <p className="text-sm text-slate-400">Best use</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    Add your flatmates, course mates, or friends and compare who is
                    most cooked this week.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}