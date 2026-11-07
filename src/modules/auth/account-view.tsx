"use client";

import { BadgeCheck, CloudCheck, LogOut, MailWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { authMessage, useAuth } from "./auth-provider";
import { useSyncStatus } from "./cloud-sync";
import { FormMessage, PasswordField, TextField } from "./fields";
import { confirmError, emailError, nameError, passwordOk } from "./validation";

type Result = { kind: "error" | "success"; text: string } | null;

/** Runs an account action and turns the outcome into one message. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setResult(null);
    try {
      await action();
      setResult({ kind: "success", text: success });
      return true;
    } catch (e) {
      const text = authMessage(e);
      if (text) setResult({ kind: "error", text });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, result, run };
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id={id} className="text-2xl font-extrabold">
          {title}
        </h2>
        {intro ? <p className="text-ink-2">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function VerifyEmail() {
  const { user, resendVerification, refresh } = useAuth();
  const { busy, result, run } = useAction();
  if (!user || user.emailVerified) return null;
  return (
    <section className="space-y-3 rounded-3xl border-2 border-honey bg-honey-tint p-5">
      <h2 className="flex items-center gap-2 text-xl font-extrabold">
        <MailWarning aria-hidden className="size-5" />
        Please confirm your email
      </h2>
      <p>
        We sent a link to <strong>{user.email}</strong>. Click it so we know the address is yours.
        That way you can always reset your password.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await refresh();
            }, "Thanks! We checked again.")
          }
        >
          I&apos;ve clicked the link
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(resendVerification, `Sent again to ${user.email}. Check your spam folder too.`)}
        >
          Send the link again
        </Button>
      </div>
      {result ? <FormMessage kind={result.kind}>{result.text}</FormMessage> : null}
    </section>
  );
}

function NameForm() {
  const { user, changeName } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [submitted, setSubmitted] = useState(false);
  const { busy, result, run } = useAction();
  const error = nameError(name);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!error) await run(() => changeName(name), "Your name is saved.");
  }
  return (
    <Section id="name-title" title="Your name">
      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <TextField id="acct-name" label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={error} showError={submitted} />
        {result ? <FormMessage kind={result.kind}>{result.text}</FormMessage> : null}
        <Button type="submit" disabled={busy}>
          Save name
        </Button>
      </form>
    </Section>
  );
}

function EmailForm() {
  const { user, changeEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { busy, result, run } = useAction();
  if (!user) return null;
  const errors = {
    email: emailError(email) ?? (email.trim().toLowerCase() === user.email?.toLowerCase() ? "That's already your email." : null),
    password: user.hasPassword && !password ? "Enter your current password to confirm it's you." : null,
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.email || errors.password) return;
    const ok = await run(
      () => changeEmail(email, user?.hasPassword ? password : undefined),
      `We sent a link to ${email.trim()}. Your email changes when you click it, and then you'll sign in with the new address.`,
    );
    if (ok) {
      setPassword("");
      setSubmitted(false);
    }
  }
  return (
    <Section
      id="email-title"
      title="Change your email"
      intro={`You sign in with ${user.email}. We'll send a link to the new address to make sure it's yours.`}
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <TextField id="new-email" label="New email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} showError={submitted} />
        {user.hasPassword ? (
          <PasswordField id="email-password" label="Current password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} showError={submitted} />
        ) : (
          <p className="text-sm text-ink-2">Google will ask you to confirm it&apos;s you.</p>
        )}
        {result ? <FormMessage kind={result.kind}>{result.text}</FormMessage> : null}
        <Button type="submit" disabled={busy}>
          Send confirmation link
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { busy, result, run } = useAction();
  if (!user) return null;
  if (!user.hasPassword) {
    return (
      <Section id="password-title" title="Password">
        <p className="text-ink-2">You sign in with Google, so there&apos;s no PieceWise password. Google looks after it.</p>
      </Section>
    );
  }
  const errors = {
    current: current ? null : "Enter your current password.",
    next: !passwordOk(next)
      ? "Your new password doesn't meet the rules below yet."
      : next === current
        ? "Choose a password that's different from your current one."
        : null,
    confirm: confirmError(next, confirm),
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.current || errors.next || errors.confirm) return;
    const ok = await run(() => changePassword(current, next), "Your password is changed. Use the new one next time you sign in.");
    if (ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setSubmitted(false);
    }
  }
  return (
    <Section id="password-title" title="Change your password">
      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <PasswordField id="current-password" label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} showError={submitted} />
        <PasswordField id="new-password" label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} showError={submitted} checklist />
        <PasswordField id="confirm-password" label="Type the new password again" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} showError={submitted} />
        {result ? <FormMessage kind={result.kind}>{result.text}</FormMessage> : null}
        <Button type="submit" disabled={busy}>
          Change password
        </Button>
      </form>
    </Section>
  );
}

const SYNC_TEXT = {
  off: "",
  loading: "Opening your saved kit…",
  saving: "Saving your kit…",
  saved: "Your kit is saved to your account. Open it from any device by signing in.",
  error: "We couldn't save your kit just now. It's still in this browser; we'll try again when it changes.",
};

export function AccountView() {
  const auth = useAuth();
  const router = useRouter();
  const sync = useSyncStatus();

  if (!auth.ready) return <p role="status">Loading your account…</p>;
  if (!auth.user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-extrabold">You&apos;re not signed in</h1>
        <ButtonLink href="/login?next=/account">Sign in</ButtonLink>
      </div>
    );
  }
  const { user } = auth;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Your account</h1>
        <p className="flex flex-wrap items-center gap-2 text-lg text-ink-2">
          {user.name ? <strong className="text-ink">{user.name}</strong> : null}
          {user.email}
          {user.emailVerified ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--fits)]">
              <BadgeCheck aria-hidden className="size-4" />
              Confirmed
            </span>
          ) : null}
        </p>
        {sync !== "off" ? (
          <p role="status" className="flex items-center gap-2 text-ink-2">
            <CloudCheck aria-hidden className="size-5 shrink-0" />
            {SYNC_TEXT[sync]}
          </p>
        ) : null}
      </header>

      <VerifyEmail />
      <NameForm />
      <EmailForm />
      <PasswordForm />

      <Button
        variant="secondary"
        onClick={() =>
          void auth.signOut().then(() => {
            router.push("/");
          })
        }
      >
        <LogOut aria-hidden className="size-4" />
        Sign out
      </Button>
      <p className="text-sm text-ink-2">Signing out clears your kit from this browser. It stays saved in your account.</p>
    </div>
  );
}
