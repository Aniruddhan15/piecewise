"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheckBig, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, cn, EmptyState } from "@/components/ui";
import { useStore } from "@/modules/board/store";
import { vendorName } from "@/modules/tool-start/summary";
import { usePersonalizedSteps } from "@/modules/tool-start/use-steps";
import { accountKey, nextUnfinished, percent, setupKey, toolProgress, type SetupTool } from "./progress";
import { usePlanData } from "./use-plan";

const START_LABEL = { signup: "Open", book_demo: "Book a demo at", marketplace_install: "Install from" } as const;

export function ProgressBar({ value, className, light }: { value: number; className?: string; light?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}% done`}
      className={cn("h-2 overflow-hidden rounded-full", light ? "bg-white/20" : "bg-surface-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", light ? "bg-honey" : "bg-brand")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function CheckItem({ id, label, done, onChange }: { id: string; label: string; done: boolean; onChange: (v: boolean) => void }) {
  return (
    <li>
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
          done ? "border-brand/40 bg-brand-soft" : "border-line bg-surface hover:border-ink-3",
        )}
      >
        <input id={id} type="checkbox" checked={done} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--focus)]",
            done ? "border-brand bg-brand text-brand-ink" : "border-ink-3",
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : null}
        </span>
        <span className={cn(done && "text-ink-2 line-through decoration-ink-3")}>{label}</span>
      </label>
    </li>
  );
}

function ToolSteps({ item }: { item: SetupTool }) {
  const { state, setCheck } = useStore();
  const checks = state.checks ?? {};
  const steps = usePersonalizedSteps(item.tool, state.profile.description);
  const vendor = vendorName(item.tool);
  const p = toolProgress(item, checks);
  const finished = p.total > 0 && p.done === p.total;

  return (
    <div key={item.tool.id} className="step-in space-y-5">
      <header className="space-y-4 rounded-3xl p-6 text-white sm:p-7" style={{ background: "var(--best-bg)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold">{item.tool.name}</h1>
            <p className="text-white/85">For: {item.jobs.map((j) => j.toLowerCase()).join(" and ")}</p>
            <p className="flex items-center gap-1.5 text-white/85">
              <Clock aria-hidden className="size-4" />
              About {item.hours} {item.hours === 1 ? "hour" : "hours"} in total
            </p>
          </div>
          <a
            href={item.tool.vendor_url}
            target="_blank"
            rel="noopener noreferrer"
            className="no-print inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-[#10241d] no-underline"
          >
            Visit {vendor}
            <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {p.done} of {p.total} steps done
          </p>
          <ProgressBar value={percent(p)} light />
        </div>
      </header>

      {finished ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl border-2 border-brand bg-brand-soft p-4 text-lg font-bold">
          <CircleCheckBig aria-hidden className="size-6 text-brand" />
          {item.tool.name} is set up. Nice work!
        </p>
      ) : null}

      <section aria-labelledby="acct" className="space-y-3">
        <h2 id="acct" className="flex items-center gap-3 text-2xl font-extrabold">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-ink text-lg text-bg">1</span>
          Create your account
        </h2>
        <ul className="space-y-2">
          {item.account.map((label, i) => {
            const key = accountKey(item.tool.id, i);
            return <CheckItem key={key} id={key} label={label} done={Boolean(checks[key])} onChange={(v) => setCheck(key, v)} />;
          })}
        </ul>
        <a
          href={item.tool.how_to_start.url}
          target="_blank"
          rel="noopener noreferrer"
          className="no-print inline-flex min-h-11 items-center gap-2 font-semibold"
        >
          {START_LABEL[item.tool.how_to_start.type]} {vendor}
          <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </section>

      <section aria-labelledby="use" className="space-y-3">
        <h2 id="use" className="flex items-center gap-3 text-2xl font-extrabold">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-ink text-lg text-bg">2</span>
          Set it up and start using it
        </h2>
        <ul className="space-y-2">
          {item.setupIdx.map((i) => {
            const key = setupKey(item.tool.id, i);
            const label = steps[i] ?? item.tool.setup.steps[i];
            return <CheckItem key={key} id={key} label={label} done={Boolean(checks[key])} onChange={(v) => setCheck(key, v)} />;
          })}
        </ul>
        {item.tool.setup.data_needed.length > 0 ? (
          <p className="rounded-2xl bg-surface-2 p-3 text-ink-2">
            <strong className="text-ink">Have this ready:</strong> {item.tool.setup.data_needed.join("; ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function SetupView({ toolId }: { toolId?: string }) {
  const router = useRouter();
  const { sequence, checks, progress } = usePlanData();
  const [chosen, setChosen] = useState<string | undefined>(toolId);

  if (sequence.length === 0) {
    return (
      <EmptyState title="Nothing to set up yet">
        <p className="mb-4">Add a tool to your kit first, then come back here to set it up step by step.</p>
        <ButtonLink href="/matches">Back to my picks</ButtonLink>
      </EmptyState>
    );
  }

  const index = Math.max(
    0,
    sequence.findIndex((t) => t.tool.id === (chosen ?? nextUnfinished(sequence, checks)?.tool.id ?? sequence[0].tool.id)),
  );
  const item = sequence[index];
  const last = index === sequence.length - 1;

  function go(i: number) {
    const target = sequence[i];
    if (!target) return;
    setChosen(target.tool.id);
    router.replace(`/setup?tool=${target.tool.id}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1 font-semibold">
        <ArrowLeft aria-hidden className="size-4" />
        My dashboard
      </Link>

      <div className="flex items-center gap-3">
        <p className="shrink-0 text-sm font-bold tracking-wide text-ink-2 uppercase">
          Tool {index + 1} of {sequence.length}
        </p>
        <div aria-hidden className="flex flex-1 gap-1">
          {sequence.map((t, i) => {
            const p = toolProgress(t, checks);
            return (
              <span
                key={t.tool.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-500",
                  i === index ? "bg-honey" : p.done === p.total ? "bg-brand" : "bg-line",
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6 overflow-x-clip">
          <ToolSteps key={item.tool.id} item={item} />
          <nav aria-label="Move between tools" className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <Button variant="ghost" disabled={index === 0} onClick={() => go(index - 1)}>
              <ArrowLeft aria-hidden className="size-4" />
              Previous tool
            </Button>
            {last ? (
              <ButtonLink href="/dashboard" size="lg">
                Finish: go to my dashboard
                <ArrowRight aria-hidden className="size-5" />
              </ButtonLink>
            ) : (
              <Button size="lg" onClick={() => go(index + 1)}>
                Next tool: {sequence[index + 1].tool.name}
                <ArrowRight aria-hidden className="size-5" />
              </Button>
            )}
          </nav>
        </div>

        <aside aria-label="All your tools" className="space-y-4 rounded-3xl border border-line bg-surface p-5 lg:sticky lg:top-20">
          <div className="space-y-1">
            <p className="font-extrabold">Overall</p>
            <p className="text-sm text-ink-2">
              {progress.done} of {progress.total} steps · {percent(progress)}%
            </p>
            <ProgressBar value={percent(progress)} />
          </div>
          <ol className="space-y-1">
            {sequence.map((t, i) => {
              const p = toolProgress(t, checks);
              const done = p.done === p.total;
              return (
                <li key={t.tool.id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index ? "step" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2",
                      i === index && "bg-honey-tint ring-2 ring-honey",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        done ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink",
                      )}
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.tool.name}</span>
                      <span className="block text-sm text-ink-2">
                        {done ? "Done" : p.done > 0 ? `${p.done} of ${p.total} steps` : "Not started"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-ink-2">Your ticks save as you go.</p>
        </aside>
      </div>
    </div>
  );
}
