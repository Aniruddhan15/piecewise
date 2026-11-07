"use client";

import { ArrowRight, CircleCheckBig, CloudCheck, ExternalLink, HardDrive, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ButtonLink, cn, EmptyState } from "@/components/ui";
import { useAuth } from "@/modules/auth/auth-provider";
import { useSyncStatus } from "@/modules/auth/cloud-sync";
import { ARCHETYPE_ICON } from "@/modules/finder/icons";
import { HexShape, shapeFromKit } from "@/modules/kit/hex-kit";
import { formatUsd } from "@/modules/plan/cost";
import { SbaPanel } from "@/modules/sba/sba-panel";
import { catalog } from "@/modules/taxonomy/catalog";
import { vendorName } from "@/modules/tool-start/summary";
import { nextUnfinished, percent, toolProgress } from "./progress";
import { ProgressBar } from "./setup-view";
import { usePlanData } from "./use-plan";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="font-display text-3xl font-extrabold">{value}</p>
      {note ? <p className="text-sm text-ink-2">{note}</p> : null}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function DashboardView() {
  const auth = useAuth();
  const sync = useSyncStatus();
  const { state, profile, plan, kit, sequence, checks, progress, anchor } = usePlanData();

  if (sequence.length === 0) {
    return (
      <EmptyState title="Your dashboard fills in once you have a plan">
        <p className="mb-4">Pick a tool or two for your business, then save your plan.</p>
        <ButtonLink href="/matches">Find my tools</ButtonLink>
      </EmptyState>
    );
  }

  const next = nextUnfinished(sequence, checks);
  const allDone = !next;
  const name = auth.user?.name?.split(" ")[0];
  const onAccount = Boolean(auth.user) && sync !== "error";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
            {profile.description || catalog.archetypeById.get(profile.archetypes[0])?.name}
            {anchor ? ` · on ${anchor.name}` : ""}
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{name ? `Welcome back, ${name}` : "Your dashboard"}</h1>
          <p className="flex flex-wrap items-center gap-2 text-ink-2">
            {onAccount ? <CloudCheck aria-hidden className="size-5 text-brand" /> : <HardDrive aria-hidden className="size-5" />}
            {state.savedAt ? `Plan saved ${formatDate(state.savedAt)}` : "Plan not saved yet"}
            {onAccount ? " to your account, on every device." : " on this device."}
            {!auth.user && auth.enabled ? (
              <Link href="/signup?next=/dashboard" className="font-semibold">
                Save it to a free account
              </Link>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/plan" variant="secondary">
            View my plan
          </ButtonLink>
          <ButtonLink href="/matches" variant="ghost">
            Change my kit
          </ButtonLink>
        </div>
      </header>

      <Reveal className="grid gap-4 sm:grid-cols-3">
        <Stat label="Setup progress" value={`${percent(progress)}%`} note={`${progress.done} of ${progress.total} steps`} />
        <Stat label="New monthly cost" value={`${formatUsd(plan.total)}${plan.hasUnknownPrice ? "+" : ""}`} note={plan.overBudget ? `Over your ${formatUsd(plan.budget)} budget` : `Within your ${formatUsd(plan.budget)} budget`} />
        <Stat label="Jobs covered" value={`${kit.covered} of ${kit.wedges.length}`} note={kit.complete ? "Your kit is complete" : "Finish your kit any time"} />
      </Reveal>

      <Reveal>
        {allDone ? (
          <section className="space-y-3 rounded-3xl p-7 text-white" style={{ background: "var(--best-bg)" }}>
            <PartyPopper aria-hidden className="size-9 text-honey" />
            <h2 className="text-3xl font-extrabold">Everything is set up</h2>
            <p className="max-w-xl text-white/85">
              All {sequence.length} tools are ready. Give them a few weeks, then come back: if one
              isn&apos;t earning its keep, change your kit.
            </p>
          </section>
        ) : (
          <section aria-labelledby="continue" className="grid items-center gap-4 rounded-3xl p-6 text-white sm:grid-cols-[1fr_auto] sm:p-7" style={{ background: "var(--best-bg)" }}>
            <div className="space-y-2">
              <p className="text-sm font-bold tracking-wide text-white/75 uppercase">
                {progress.done === 0 ? "Start here" : "Pick up where you left off"}
              </p>
              <h2 id="continue" className="text-3xl font-extrabold">
                Set up {next.tool.name}
              </h2>
              <p className="text-white/85">
                {toolProgress(next, checks).done} of {toolProgress(next, checks).total} steps done · about {next.hours}{" "}
                {next.hours === 1 ? "hour" : "hours"}
              </p>
              <ProgressBar value={percent(toolProgress(next, checks))} light className="max-w-md" />
            </div>
            <Link
              href={`/setup?tool=${next.tool.id}`}
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-honey px-6 text-lg font-semibold text-[#10241d] no-underline transition-transform hover:scale-[1.02]"
            >
              {progress.done === 0 ? "Start setup" : "Continue"}
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </section>
        )}
      </Reveal>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Reveal as="section" aria-labelledby="tools" className="space-y-3">
          <h2 id="tools" className="text-2xl font-extrabold">
            Your tools
          </h2>
          <ul className="space-y-3">
            {sequence.map((t, i) => {
              const p = toolProgress(t, checks);
              const done = p.done === p.total;
              return (
                <li key={t.tool.id} className="lift rounded-2xl border border-line bg-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl font-bold",
                        done ? "bg-brand text-brand-ink" : "bg-surface-2",
                      )}
                    >
                      {done ? <CircleCheckBig className="size-5" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-lg font-bold">{t.tool.name}</p>
                      <p className="text-sm text-ink-2">
                        {t.jobs.join(" · ")} · {done ? "Done" : p.done > 0 ? `${p.done} of ${p.total} steps` : "Not started"}
                      </p>
                      <ProgressBar value={percent(p)} className="max-w-sm" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={`/setup?tool=${t.tool.id}`} size="sm" variant={done ? "ghost" : "secondary"}>
                        {done ? "Review" : p.done > 0 ? "Continue" : "Start"}
                      </ButtonLink>
                      <a
                        href={t.tool.vendor_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold"
                      >
                        {vendorName(t.tool)}
                        <ExternalLink aria-hidden className="size-3.5" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal as="aside" aria-label="Your kit" className="space-y-3 rounded-3xl border border-line bg-surface p-5">
          <p className="font-extrabold">Your kit</p>
          <HexShape
            wedges={shapeFromKit(kit)}
            hubTitle={anchor?.name ?? catalog.archetypeById.get(profile.archetypes[0])?.examples[0] ?? "You"}
            hubIcon={ARCHETYPE_ICON[profile.archetypes[0]]}
            complete={kit.complete}
            className="mx-auto max-w-[16rem]"
          />
          <p className="text-center text-sm text-ink-2">
            {kit.covered} of {kit.wedges.length} jobs covered
          </p>
        </Reveal>
      </div>

      <Reveal as="section" aria-label="Free help">
        <SbaPanel />
      </Reveal>
    </div>
  );
}
