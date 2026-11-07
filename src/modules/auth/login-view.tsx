"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { hasProfile, useStore } from "@/modules/board/store";
import { authMessage, useAuth } from "./auth-provider";
import { FormMessage, GoogleMark, PasswordField, TextField } from "./fields";
import { confirmError, emailError, nameError, passwordOk } from "./validation";

export type Mode = "signin" | "signup" | "reset";

const PATH: Record<Mode, string> = { signin: "/login", signup: "/signup", reset: "/forgot-password" };

/** One page per job: sign in, create an account, or reset a password. */
export function AuthView({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const { state } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const next = params.get("next") ?? (hasProfile(state) ? "/matches" : "/");

  // Already signed in (or just signed in): carry on where they were.
  useEffect(() => {
    if (auth.user && mode !== "signup") router.replace(next);
  }, [auth.user, mode, next, router]);

  /** Link to another auth page, keeping where to go afterwards. */
  const linkTo = (m: Mode) => (params.get("next") ? `${PATH[m]}?next=${encodeURIComponent(next)}` : PATH[m]);

  const errors = {
    name: mode === "signup" ? nameError(name) : null,
    email: emailError(email),
    password:
      mode === "reset"
        ? null
        : !password
          ? "Enter your password."
          : mode === "signup" && !passwordOk(password)
            ? "Your password doesn't meet the rules below yet."
            : null,
    confirm: mode === "signup" ? confirmError(password, confirm) : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (success) setDone(success);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    if (mode === "signin") await run(() => auth.signIn(email, password));
    if (mode === "reset") {
      await run(
        () => auth.resetPassword(email),
        `If there's an account for ${email.trim()}, we've sent a link to reset the password. Check your inbox and spam folder.`,
      );
    }
    if (mode === "signup") {
      await run(async () => {
        await auth.signUp(name, email, password);
        router.replace(next);
      });
    }
  }

  if (!auth.enabled) {
    return (
      <div className="mx-auto max-w-md space-y-3 text-center">
        <h1 className="text-3xl font-extrabold">Accounts aren&apos;t set up yet</h1>
        <p className="text-ink-2">Everything still works without one: your kit is saved in this browser.</p>
        <Link href="/">Back to the start</Link>
      </div>
    );
  }

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Save your kit" : "Reset your password";
  const intro =
    mode === "signin"
      ? "Sign in to open your saved kit on any device."
      : mode === "signup"
        ? "Create a free account so your kit is there next time, on any device. You don't need one to use PieceWise."
        : "Enter the email you signed up with and we'll send you a link to choose a new password.";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-4xl font-extrabold">{title}</h1>
        <p className="text-lg text-ink-2">{intro}</p>
      </header>

      <div className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        {mode !== "reset" ? (
          <>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void run(() => auth.signInWithGoogle())}
            >
              <GoogleMark />
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-sm text-ink-2">
              <span className="h-px flex-1 bg-line" />
              or with your email
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        ) : null}

        <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
          {mode === "signup" ? (
            <TextField
              id="name"
              label="Your name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              showError={submitted}
            />
          ) : null}
          <TextField
            id="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            showError={submitted}
          />
          {mode !== "reset" ? (
            <PasswordField
              id="password"
              label="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              showError={submitted}
              checklist={mode === "signup"}
            />
          ) : null}
          {mode === "signup" ? (
            <PasswordField
              id="confirm"
              label="Type the password again"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
              showError={submitted}
            />
          ) : null}

          {error ? <FormMessage kind="error">{error}</FormMessage> : null}
          {done ? <FormMessage kind="success">{done}</FormMessage> : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create my account"
                  : "Send reset link"}
          </Button>
        </form>

        {mode === "signin" ? (
          <p className="text-center">
            <Link href={linkTo("reset")} className="inline-flex min-h-11 items-center font-semibold">
              Forgot your password?
            </Link>
          </p>
        ) : null}
      </div>

      <p className="text-center text-lg">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <Link href={linkTo("signup")} className="font-semibold">
              Create a free account
            </Link>
          </>
        ) : mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={linkTo("signin")} className="font-semibold">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Remembered it?{" "}
            <Link href={linkTo("signin")} className="font-semibold">
              Back to sign in
            </Link>
          </>
        )}
      </p>
      <p className="text-center text-ink-2">
        <Link href={next} className="font-semibold text-ink-2">
          Continue without an account
        </Link>
      </p>
    </div>
  );
}
