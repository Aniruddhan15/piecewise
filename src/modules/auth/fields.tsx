"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn, inputClass } from "@/components/ui";
import { passwordChecks } from "./validation";

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  /** Shown only once the field has been touched or the form submitted. */
  error?: string | null;
  showError?: boolean;
  help?: string;
};

export function TextField({ id, label, error, showError, help, className, ...props }: FieldProps) {
  const visible = Boolean(showError && error);
  const describedBy = [help ? `${id}-help` : "", visible ? `${id}-error` : ""].filter(Boolean).join(" ");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={visible || undefined}
        aria-describedby={describedBy || undefined}
        className={cn(inputClass, visible && "border-[color:var(--notallowed-line)]", className)}
        {...props}
      />
      {help ? (
        <p id={`${id}-help`} className="text-sm text-ink-2">
          {help}
        </p>
      ) : null}
      {visible ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-[color:var(--notallowed)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a Show button, and an optional live checklist of the rules. */
export function PasswordField({
  checklist,
  ...props
}: FieldProps & { checklist?: boolean }) {
  const [shown, setShown] = useState(false);
  const value = String(props.value ?? "");
  return (
    <div className="space-y-2">
      <div className="relative">
        <TextField {...props} type={shown ? "text" : "password"} className="pr-24" />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-controls={props.id}
          className="absolute top-[2.05rem] right-1.5 flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
        >
          {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {checklist ? (
        <ul aria-label="Password rules" className="space-y-0.5 text-sm">
          {passwordChecks(value).map((c) => (
            <li key={c.label} className={cn("flex items-center gap-1.5", c.ok ? "text-[color:var(--fits)]" : "text-ink-2")}>
              {c.ok ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
              {c.label}
              <span className="sr-only">{c.ok ? "(done)" : "(not yet)"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One message line for the result of a form: errors in red, success in green. */
export function FormMessage({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-3 py-2 font-semibold",
        kind === "error"
          ? "state-not_allowed bg-[color:var(--state-tint)] text-[color:var(--state)]"
          : "state-fits bg-[color:var(--state-tint)] text-[color:var(--state)]",
      )}
    >
      {children}
    </p>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
