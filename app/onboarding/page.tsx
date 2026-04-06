"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function checkProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        router.push("/");
        return;
      }

      setLoading(false);
    }

    checkProfile();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("You need to be logged in.");
      setSaving(false);
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username: cleanUsername,
      university: university.trim(),
      course: course.trim(),
    });

    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        setErrorMessage("That username is already taken.");
      } else {
        setErrorMessage(error.message);
      }
      setSaving(false);
      return;
    }

    router.push("/");
  }

  if (loading) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold mb-2">Set up your profile</h1>
        <p className="text-white/70 mb-6">
          Choose how you appear on LockdIn.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 outline-none"
              placeholder="@charlie"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">University</label>
            <input
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              required
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 outline-none"
              placeholder="University of Leeds"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Course</label>
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 outline-none"
              placeholder="Computer Science"
            />
          </div>

          {errorMessage ? (
            <p className="text-red-400 text-sm">{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-white text-black font-semibold py-3"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}