"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = getSupabaseClient();
      const isRecovery = new URLSearchParams(window.location.search).get("mode") === "recovery";
      if (isRecovery) setMode("recovery");

      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (mounted && event === "PASSWORD_RECOVERY") setMode("recovery");
      });

      supabase.auth.getSession().then(({ data }) => {
        if (mounted && data.session && !isRecovery) router.replace("/dashboard");
      });

      return () => {
        mounted = false;
        authListener.subscription.unsubscribe();
      };
    } catch (configurationError) {
      setError(
        configurationError instanceof Error
          ? configurationError.message
          : "Supabase is not configured.",
      );
    }
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if ((mode === "signup" || mode === "recovery") && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (mode === "recovery") {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setNotice("Your password was updated. You can now sign in.");
        return;
      }

      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/dashboard`,
              data: { full_name: name.trim() },
            },
          });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("login");
        setName("");
        setPassword("");
        setConfirmPassword("");
      } else {
        router.replace("/dashboard");
      }
    } catch (authenticationError) {
      setError(
        authenticationError instanceof Error
          ? authenticationError.message
          : "Authentication failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sendRecoveryEmail = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { error: recoveryError } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?mode=recovery`,
      });
      if (recoveryError) throw recoveryError;
      setNotice("Check your email for a password reset link.");
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Unable to send the password reset email.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-10 text-[#18212b]">
      <section className="w-full max-w-md rounded-3xl border border-[#e5e9ed] bg-white p-7 shadow-[0_18px_45px_rgba(29,42,53,0.08)] sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-[#c9f5d6] text-[#268249]">
            <span className="text-xl font-bold">d</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7fa38a]">
            daymark
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.04em]">
            {isRecovery ? "Set a new password" : isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-[#89939c]">
            {isRecovery
              ? "Choose a new password for your account."
              : isSignup
              ? "Start building better routines together."
              : "Sign in to continue your shared routines."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {isSignup && (
            <label className="block text-sm font-semibold text-[#46535d]">
              Name
              <input
                required
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#dfe5e1] px-3.5 py-3 text-sm outline-none transition focus:border-[#65bd7b] focus:ring-2 focus:ring-[#e1f4e5]"
                placeholder="Your name"
              />
            </label>
          )}

          {!isRecovery && (
            <label className="block text-sm font-semibold text-[#46535d]">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#dfe5e1] px-3.5 py-3 text-sm outline-none transition focus:border-[#65bd7b] focus:ring-2 focus:ring-[#e1f4e5]"
              placeholder="you@example.com"
            />
            </label>
          )}

          <label className="block text-sm font-semibold text-[#46535d]">
            Password
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#dfe5e1] px-3.5 py-3 text-sm outline-none transition focus:border-[#65bd7b] focus:ring-2 focus:ring-[#e1f4e5]"
              placeholder="At least 6 characters"
            />
          </label>

          {(isSignup || isRecovery) && (
            <label className="block text-sm font-semibold text-[#46535d]">
              Confirm password
              <input
                required
                minLength={6}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#dfe5e1] px-3.5 py-3 text-sm outline-none transition focus:border-[#65bd7b] focus:ring-2 focus:ring-[#e1f4e5]"
                placeholder="Repeat your password"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-[#fff1ee] px-3.5 py-3 text-sm text-[#a04c40]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-[#edf9f0] px-3.5 py-3 text-sm text-[#347d49]">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#24322d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#31443a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Please wait..." : isRecovery ? "Update password" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={sendRecoveryEmail}
            disabled={loading}
            className="mt-4 w-full text-sm font-semibold text-[#31834b] hover:text-[#236b3a] disabled:opacity-60"
          >
            Forgot your password?
          </button>
        )}

        {!isRecovery && <p className="mt-6 text-center text-sm text-[#89939c]">
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError("");
              setNotice("");
            }}
            className="font-bold text-[#31834b] hover:text-[#236b3a]"
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </p>}
      </section>
    </main>
  );
}
