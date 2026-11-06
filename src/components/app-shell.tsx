"use client";

import { Check, Puzzle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { hasProfile, useStore } from "@/modules/board/store";
import { cn } from "./ui";

const STEPS = [
  { label: "Describe", href: "/start", match: ["/start"] },
  { label: "Base", href: "/base", match: ["/base"] },
  { label: "Puzzle", href: "/board", match: ["/board", "/block", "/compare"] },
  { label: "Plan", href: "/plan", match: ["/plan"] },
];

function StepProgress() {
  const pathname = usePathname();
  const { state, ready } = useStore();
  const current = STEPS.findIndex((s) => s.match.some((m) => pathname.startsWith(m)));
  const canJump = ready && hasProfile(state);

  return (
    <nav aria-label="Your progress" className="no-print">
      <ol className="flex items-center gap-1 text-sm sm:gap-2">
        {STEPS.map((step, i) => {
          const done = current > i;
          const active = current === i;
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-bold",
                  active && "border-brand bg-brand text-brand-ink",
                  done && "border-brand text-brand",
                  !active && !done && "border-line text-ink-2",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("hidden sm:inline", active ? "font-semibold" : "text-ink-2")}>
                {step.label}
              </span>
              <span className="sr-only sm:hidden">{step.label}</span>
            </>
          );
          return (
            <li key={step.label} aria-current={active ? "step" : undefined}>
              {canJump || step.href === "/start" ? (
                <Link href={step.href} className="flex min-h-11 items-center gap-1.5 px-1 no-underline">
                  {body}
                </Link>
              ) : (
                <span className="flex min-h-11 items-center gap-1.5 px-1">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { reset, state, ready } = useStore();
  const showSteps = pathname !== "/";
  const showReset = ready && (hasProfile(state) || Boolean(state.demoId));

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2"
      >
        Skip to main content
      </a>
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 font-display text-xl font-bold text-ink no-underline"
          >
            <Puzzle aria-hidden className="size-6 text-brand" />
            PieceWise
          </Link>
          {showSteps ? <StepProgress /> : null}
          {showReset ? (
            <button
              type="button"
              onClick={() => {
                reset();
                router.push("/");
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-2"
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset
            </button>
          ) : null}
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-ink-2">
          Vendor-neutral. We never charge you. Tool facts come with a source and a date, and prices
          change, so check the vendor before you buy.
        </div>
      </footer>
    </div>
  );
}
