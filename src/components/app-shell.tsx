"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/modules/auth/auth-provider";
import { hasProfile, useStore } from "@/modules/board/store";
import { cn } from "./ui";

const TEXT_KEY = "piecewise:text-large";

/** The PieceWise mark: six pieces closing around a center. */
export function Mark({ className }: { className?: string }) {
  const colors = ["#0f7a5c", "#2463b0", "#a8550f", "#a83d62", "#5a4bb8", "#1d7c8c"];
  return (
    <svg viewBox="-12 -12 24 24" aria-hidden className={className}>
      {colors.map((c, k) => {
        const a0 = ((-120 + k * 60) * Math.PI) / 180;
        const a1 = ((-60 + k * 60) * Math.PI) / 180;
        const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
        return <polygon key={c} points={`${p(4, a0)} ${p(11, a0)} ${p(11, a1)} ${p(4, a1)}`} fill={c} stroke="var(--bg)" strokeWidth="0.9" />;
      })}
      <circle r="3.1" fill="var(--honey)" />
    </svg>
  );
}

function AccountLink() {
  const { enabled, ready, user } = useAuth();
  const pathname = usePathname();
  if (!enabled || !ready) return null;
  if (!user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink no-underline hover:border-ink-3"
      >
        Sign in
      </Link>
    );
  }
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <Link
      href="/account"
      aria-label={`Your account (${user.name ?? user.email})`}
      aria-current={pathname === "/account" ? "page" : undefined}
      className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-ink no-underline hover:bg-surface-2"
    >
      <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand font-bold text-brand-ink">
        {initial}
      </span>
      <span className="hidden sm:inline">Account</span>
    </Link>
  );
}

function TextSizeToggle() {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem(TEXT_KEY) === "1";
    } catch {
      // Default size.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference
    setLarge(saved);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("text-large", large);
  }, [large]);
  return (
    <button
      type="button"
      aria-pressed={large}
      onClick={() => {
        const next = !large;
        setLarge(next);
        try {
          window.localStorage.setItem(TEXT_KEY, next ? "1" : "0");
        } catch {
          // Works for this visit.
        }
      }}
      className={cn(
        "flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold hover:bg-surface-2",
        large && "bg-surface-2",
      )}
    >
      <span aria-hidden className="font-display text-base leading-none">
        A<span className="text-lg">A</span>
      </span>
      <span className="sr-only sm:not-sr-only">Larger text</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { reset, state, ready } = useStore();
  const started = ready && (hasProfile(state) || Boolean(state.demoId));
  const count = Object.keys(state.pieces).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2"
      >
        Skip to main content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink no-underline"
          >
            <Mark className="size-7" />
            PieceWise
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            <TextSizeToggle />
            {started ? (
              <>
                <Link
                  href="/plan"
                  aria-current={pathname === "/plan" ? "page" : undefined}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink no-underline hover:bg-surface-2"
                >
                  My kit
                  <span className="flex min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-bold text-bg">
                    {count}
                  </span>
                </Link>
                {state.savedAt ? (
                  <Link
                    href="/dashboard"
                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                    className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink no-underline hover:bg-surface-2"
                  >
                    Dashboard
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    router.push("/");
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-2 hover:bg-surface-2"
                >
                  <RotateCcw aria-hidden className="size-4" />
                  <span className="sr-only sm:not-sr-only">Start over</span>
                </button>
              </>
            ) : null}
            <AccountLink />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-ink-2 sm:flex-row sm:justify-between">
          <p>Vendor-neutral and free. No vendor can pay for a spot.</p>
          <p>Every fact links to its source. Prices change, so check before you buy.</p>
        </div>
      </footer>
    </div>
  );
}
