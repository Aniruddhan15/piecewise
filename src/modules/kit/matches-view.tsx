"use client";

import { ArrowRight, Check, CircleDollarSign, Clock, Link2, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Reveal } from "@/components/reveal";
import { Button, ButtonLink, cn } from "@/components/ui";
import { useStore } from "@/modules/board/store";
import { StateBadge } from "@/modules/board/state-badge";
import { resolveAnchor } from "@/modules/compat-engine/engine";
import { painsFor } from "@/modules/finder/pains";
import { formatUsd } from "@/modules/plan/cost";
import { catalog } from "@/modules/taxonomy/catalog";
import { useExplanation } from "@/modules/tool-card/tool-card";
import { KitPanel } from "./kit-panel";
import {
  applyAnswer,
  kitState,
  NOT_SURE,
  questionsThatMatter,
  topPicks,
  type KitInput,
  type Pick,
  type Question,
} from "./kit";

function QuestionCard({ question, onAnswer }: { question: Question; onAnswer: (value: string) => void }) {
  return (
    <section
      key={question.id}
      aria-labelledby={`q-${question.id}`}
      className="rise space-y-4 rounded-3xl border-2 border-honey bg-honey-tint p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">One quick question</p>
        <h2 id={`q-${question.id}`} className="text-2xl font-extrabold">
          {question.prompt}
        </h2>
        {question.help ? <p className="text-ink-2">{question.help}</p> : null}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {question.options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              onClick={() => onAnswer(o.value)}
              className={cn(
                "flex h-full min-h-14 w-full flex-col justify-center rounded-xl border bg-surface px-3 py-2 text-left font-semibold transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-md",
                o.value === NOT_SURE ? "border-dashed border-ink-3 text-ink-2" : "border-line",
              )}
            >
              {o.label}
              {o.hint ? <span className="text-sm font-normal text-ink-2">{o.hint}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ icon: Icon, label, value, warn }: { icon: typeof Clock; label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <dt className="flex items-center gap-1 text-xs font-semibold tracking-wide text-ink-2 uppercase">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </dt>
      <dd className={cn("font-bold", warn && "text-[color:var(--catch)]")}>{value}</dd>
    </div>
  );
}

function ToolPick({ pick, index }: { pick: Extract<Pick, { kind: "tool" }>; index: number }) {
  const { state, setPiece } = useStore();
  const { profile } = state;
  const { tool, verdict, cost } = pick.match;
  const sentence = useExplanation(tool, verdict, profile, true);
  const anchor = resolveAnchor(profile, catalog);
  const canAdd = verdict.visible === "fits" || verdict.visible === "catch";
  const price =
    cost.already_included
      ? "Included"
      : cost.monthly_usd === null
        ? "Ask vendor"
        : cost.monthly_usd === 0
          ? "Free"
          : `${formatUsd(cost.monthly_usd)}/mo`;
  const connects = anchor
    ? verdict.visible === "fits"
      ? `${anchor.name} ✓`
      : verdict.visible === "catch"
        ? `${anchor.name}, with a catch`
        : `Not ${anchor.name}`
    : "Tell us your system";

  return (
    <article
      className={cn(
        "lift space-y-4 rounded-3xl border bg-surface p-5 sm:p-6",
        pick.added ? "border-brand ring-2 ring-brand/30" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
          {index + 1} · {pick.block.plain_name}
        </p>
        {anchor || verdict.visible !== "fits" ? <StateBadge state={verdict.visible} /> : null}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-2xl font-extrabold sm:text-3xl">{tool.name}</h3>
        <p className="text-lg">{sentence}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Fact icon={CircleDollarSign} label="Cost" value={price} warn={Boolean(pick.match.fit?.over_budget)} />
        <Fact icon={Clock} label="Setup" value={`About ${tool.setup.hours_estimate} hr`} />
        <Fact icon={Link2} label="Works with" value={connects} warn={verdict.visible === "catch"} />
      </dl>
      <div className="no-print flex flex-wrap items-center gap-2">
        {canAdd ? (
          <Button
            size="lg"
            variant={pick.added ? "secondary" : "primary"}
            onClick={() => setPiece(pick.block.id, pick.added ? null : tool.id)}
            aria-pressed={pick.added}
          >
            {pick.added ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
            {pick.added ? "In my kit" : "Add to my kit"}
          </Button>
        ) : null}
        <ButtonLink href={`/tool/${tool.id}?block=${pick.block.id}`} size="lg" variant="secondary">
          How to start
          <ArrowRight aria-hidden className="size-5" />
        </ButtonLink>
        <Link href={`/block/${pick.block.id}`} className="inline-flex min-h-11 items-center px-2 font-semibold">
          Other options
        </Link>
      </div>
    </article>
  );
}

function IncludedPick({ pick, index }: { pick: Extract<Pick, { kind: "included" }>; index: number }) {
  return (
    <article
      className="lift space-y-3 rounded-3xl border-2 border-brand bg-brand-soft p-5 sm:p-6"
    >
      <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
        {index + 1} · {pick.block.plain_name}
      </p>
      <h3 className="text-2xl font-extrabold sm:text-3xl">You already have this</h3>
      <p className="text-lg">
        <strong>{pick.feature}</strong> comes with {pick.source}
        {pick.addonUsd ? ` as a ${formatUsd(pick.addonUsd)} a month add-on` : ""}. Try it before
        you pay for anything new.
      </p>
      <p className="flex items-center gap-1.5 font-semibold text-brand">
        <Check aria-hidden className="size-5" />
        Already counted in your kit
      </p>
      <Link href={`/block/${pick.block.id}`} className="inline-flex min-h-11 items-center font-semibold">
        Compare with other tools
      </Link>
    </article>
  );
}

export function MatchesView() {
  const { state, setProfile, markAsked } = useStore();
  const { profile, pieces } = state;
  const [updated, setUpdated] = useState("");

  const input: KitInput = useMemo(
    () => ({ profile, pieces, pains: state.suggested ?? [], skipped: state.skipped ?? [] }),
    [profile, pieces, state.suggested, state.skipped],
  );
  const kit = useMemo(() => kitState(input, catalog), [input]);
  const picks = useMemo(() => topPicks(input, catalog), [input]);
  const question = useMemo(
    () => questionsThatMatter(input, state.asked ?? [], catalog)[0],
    [input, state.asked],
  );

  const archetype = catalog.archetypeById.get(profile.archetypes[0]);
  const anchor = resolveAnchor(profile, catalog);
  const painLabels = painsFor(profile.archetypes);
  const named = (state.suggested ?? [])
    .map((id) => painLabels.find((p) => p.block === id)?.label ?? catalog.blockById.get(id)?.plain_name)
    .filter(Boolean);

  function answer(q: Question, value: string) {
    setProfile((p) => applyAnswer(p, q, value, catalog));
    markAsked(q.id);
    const label = q.options.find((o) => o.value === value)?.label;
    setUpdated(value === NOT_SURE ? "No problem. We'll keep the picks general." : `Updated your picks for ${label}.`);
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
            {archetype?.name}
            {anchor ? ` · on ${anchor.name}` : ""}
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Start with these</h1>
          {named.length > 0 ? (
            <p className="text-lg text-ink-2">
              Because you said: {named.map((n) => `“${n}”`).join(", ")}.{" "}
              <Link href="/" className="font-semibold">
                Change
              </Link>
            </p>
          ) : (
            <p className="text-lg text-ink-2">
              The jobs where AI tools help most in your line of work.{" "}
              <Link href="/" className="font-semibold">
                Tell us your problems
              </Link>
            </p>
          )}
        </header>

        {question ? <QuestionCard question={question} onAnswer={(v) => answer(question, v)} /> : null}
        <p role="status" className="min-h-6 font-semibold text-brand">
          {updated}
        </p>

        <ol className="space-y-4">
          {picks.map((p, i) => (
            <Reveal as="li" delay={i * 80} key={`${p.block.id}-${p.kind === "tool" ? p.match.tool.id : "inc"}`}>
              {p.kind === "tool" ? <ToolPick pick={p} index={i} /> : <IncludedPick pick={p} index={i} />}
            </Reveal>
          ))}
        </ol>

        {picks.some((p) => p.kind === "tool" && p.match.verdict.visible === "catch") ? (
          <p className="flex gap-2 text-ink-2">
            <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
            &ldquo;With a catch&rdquo; means it works, but there&apos;s something to pay for or watch.
            Open &ldquo;Why we picked this&rdquo; to see what.
          </p>
        ) : null}

        <p>
          <Link href="/board" className="font-semibold">
            See every job and every tool
          </Link>
        </p>
      </div>

      <div className="lg:sticky lg:top-20">
        <KitPanel kit={kit} />
      </div>
    </div>
  );
}
