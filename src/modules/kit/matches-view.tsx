"use client";

import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn } from "@/components/ui";
import { chosenTools, useStore } from "@/modules/board/store";
import { resolveAnchor } from "@/modules/compat-engine/engine";
import { painsFor } from "@/modules/finder/pains";
import { matchBlock } from "@/modules/matcher/match";
import { formatUsd } from "@/modules/plan/cost";
import { catalog } from "@/modules/taxonomy/catalog";
import { OptionCard } from "@/modules/tool-start/option-card";
import { KitPanel } from "./kit-panel";
import {
  applyAnswer,
  kitState,
  NOT_SURE,
  questionsThatMatter,
  type KitInput,
  type KitState,
  type Question,
} from "./kit";

/**
 * Guided picks (M13.F2): one job at a time, in the kit's order. Adding a tool fills that
 * piece of the shape and moves on to the next job by itself; Previous, Next and the shape
 * itself let the owner move around by hand.
 */

const MAX_CARDS = 3;
const ADVANCE_MS = 900;
const DONE = "__done";

const isOpen = (kit: KitState, id: string) => {
  const w = kit.wedges.find((x) => x.block.id === id);
  return Boolean(w && (w.status === "next" || w.status === "locked"));
};

/** The next job still open after `id`, wrapping around to earlier ones. */
function nextOpenAfter(kit: KitState, id: string): string | null {
  const ids = kit.wedges.map((w) => w.block.id);
  const at = ids.indexOf(id);
  for (const candidate of [...ids.slice(at + 1), ...ids.slice(0, Math.max(0, at))]) {
    if (isOpen(kit, candidate)) return candidate;
  }
  return null;
}

function QuestionCard({ question, onAnswer }: { question: Question; onAnswer: (value: string) => void }) {
  return (
    <section
      key={question.id}
      aria-labelledby={`q-${question.id}`}
      className="rise space-y-3 rounded-3xl border-2 border-honey bg-honey-tint p-5"
    >
      <div className="space-y-1">
        <h2 id={`q-${question.id}`} className="text-xl font-extrabold">
          <span className="mr-2 text-sm font-bold tracking-wide text-ink-2 uppercase">Quick question</span>
          {question.prompt}
        </h2>
        {question.help ? <p className="text-ink-2">{question.help}</p> : null}
      </div>
      <ul className="flex flex-wrap gap-2">
        {question.options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              onClick={() => onAnswer(o.value)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border bg-surface px-4 py-1.5 text-left font-semibold transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-md",
                o.value === NOT_SURE ? "border-dashed border-ink-3 text-ink-2" : "border-line",
              )}
            >
              {o.label}
              {o.hint ? <span className="text-sm font-normal text-ink-2">({o.hint.toLowerCase()})</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MatchesView() {
  const { state, setProfile, setPiece, markAsked, toggleSkipped } = useStore();
  const { profile, pieces } = state;
  const [focus, setFocus] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const input: KitInput = useMemo(
    () => ({ profile, pieces, pains: state.suggested ?? [], skipped: state.skipped ?? [] }),
    [profile, pieces, state.suggested, state.skipped],
  );
  const kit = useMemo(() => kitState(input, catalog), [input]);
  const kitRef = useRef(kit);
  useEffect(() => {
    kitRef.current = kit;
  }, [kit]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const question = useMemo(
    () => questionsThatMatter(input, state.asked ?? [], catalog)[0],
    [input, state.asked],
  );

  const ids = kit.wedges.map((w) => w.block.id);
  const firstOpen = kit.wedges.find((w) => w.status === "next")?.block.id ?? null;
  const showDone = focus === DONE || (!focus && !firstOpen);
  const current = showDone ? null : focus && ids.includes(focus) ? focus : firstOpen;
  const step = current ? ids.indexOf(current) : -1;
  const wedge = current ? kit.wedges[step] : undefined;
  const block = wedge?.block;
  const anchor = resolveAnchor(profile, catalog);
  const archetype = catalog.archetypeById.get(profile.archetypes[0]);

  const results = useMemo(
    () => (block ? matchBlock(block, profile, chosenTools(pieces), catalog) : null),
    [block, profile, pieces],
  );
  const options = results ? [...results.fits, ...results.catches] : [];
  const included = results?.included.find((i) => !i.toolId);
  const pain = block
    ? painsFor(profile.archetypes).find((p) => p.block === block.id && state.suggested?.includes(p.block))
    : undefined;
  const open = wedge ? wedge.status === "next" || wedge.status === "locked" : false;

  function go(id: string | null) {
    window.clearTimeout(timer.current);
    setFocus(id ?? DONE);
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** After a pick or a skip: let the shape fill in, then move on. */
  function advanceFrom(id: string) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go(nextOpenAfter(kitRef.current, id)), ADVANCE_MS);
  }

  function toggleTool(toolId: string, name: string) {
    if (!block) return;
    if (pieces[block.id] === toolId) {
      setPiece(block.id, null);
      setMessage(`Took ${name} out of your kit.`);
      return;
    }
    setPiece(block.id, toolId);
    const filled: KitState = {
      ...kit,
      wedges: kit.wedges.map((w) => (w.block.id === block.id ? { ...w, status: "added" } : w)),
    };
    const after = nextOpenAfter(filled, block.id);
    const nextName = after ? catalog.blockById.get(after)?.plain_name : null;
    setMessage(nextName ? `Added ${name}. Next: ${nextName}.` : `Added ${name}. That closes your kit!`);
    advanceFrom(block.id);
  }

  function skip() {
    if (!block) return;
    if (open) toggleSkipped(block.id);
    setMessage(`Okay, you're fine on “${block.plain_name}”.`);
    advanceFrom(block.id);
  }

  function next() {
    if (!block) return;
    const after = nextOpenAfter(kit, block.id);
    go(after ?? (step < ids.length - 1 ? ids[step + 1] : null));
  }

  function answer(q: Question, value: string) {
    setProfile((p) => applyAnswer(p, q, value, catalog));
    markAsked(q.id);
    const label = q.options.find((o) => o.value === value)?.label;
    setMessage(value === NOT_SURE ? "No problem. We'll keep the picks general." : `Updated your picks for ${label}.`);
  }

  return (
    <div ref={top} className="grid scroll-mt-24 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-5 overflow-x-clip">
        <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
          {archetype?.name}
          {anchor ? ` · on ${anchor.name}` : ""}
          {" · "}
          <Link href="/" className="normal-case underline underline-offset-4">
            Change answers
          </Link>
        </p>

        {question ? <QuestionCard question={question} onAnswer={(v) => answer(question, v)} /> : null}

        <p role="status" className="min-h-6 font-semibold text-brand">
          {message}
        </p>

        {showDone || !block ? (
          <section className="step-in space-y-4 rounded-3xl p-8 text-center text-white" style={{ background: "var(--best-bg)" }}>
            <PartyPopper aria-hidden className="mx-auto size-10 text-honey" />
            <h1 className="text-4xl font-extrabold sm:text-5xl">Your kit is complete</h1>
            <p className="mx-auto max-w-xl text-lg text-white/85">
              Every job has an answer. Your plan has the costs, the order to set things up, and free
              help near you.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/plan"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-honey px-6 font-semibold text-[#10241d] no-underline"
              >
                See my plan
                <ArrowRight aria-hidden className="size-5" />
              </Link>
              <button
                type="button"
                onClick={() => go(ids[0] ?? null)}
                className="min-h-12 rounded-full px-5 font-semibold text-white ring-2 ring-white/60"
              >
                Review my jobs
              </button>
            </div>
          </section>
        ) : (
          <section key={block.id} aria-labelledby="job-title" className="step-in space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="shrink-0 text-sm font-bold tracking-wide text-ink-2 uppercase">
                  Job {step + 1} of {ids.length}
                </p>
                <div aria-hidden className="flex flex-1 gap-1">
                  {kit.wedges.map((w, i) => (
                    <span
                      key={w.block.id}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors duration-500",
                        i === step
                          ? "bg-honey"
                          : w.status === "next" || w.status === "locked"
                            ? "bg-line"
                            : "bg-brand",
                      )}
                    />
                  ))}
                </div>
              </div>
              <h1 id="job-title" className="text-4xl font-extrabold sm:text-5xl">
                {block.plain_name}
              </h1>
              <p className="text-lg text-ink-2">
                {pain ? `Because you said “${pain.label}”. ` : `${block.description} `}
                {options.length > 0 && open ? "Pick one and we'll take you to the next job." : ""}
              </p>
            </div>

            {included ? (
              <div className="space-y-2 rounded-3xl border-2 border-brand bg-brand-soft p-6">
                <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink-2 uppercase">
                  <Check aria-hidden className="size-4 text-brand" />
                  Already yours
                </p>
                <h2 className="text-2xl font-extrabold">You already have this</h2>
                <p className="text-lg">
                  <strong>{included.feature}</strong> comes with {included.source}
                  {included.addon_monthly_usd
                    ? ` as a ${formatUsd(included.addon_monthly_usd)} a month add-on`
                    : ""}
                  . Try it before you pay for anything new.
                </p>
              </div>
            ) : null}

            {options.length > 0 ? (
              <>
                {included ? <h2 className="text-xl font-extrabold">Or choose a separate tool</h2> : null}
                <ul
                  className={cn(
                    "grid gap-x-4 gap-y-2",
                    options.length === 1 ? "max-w-sm" : "sm:grid-cols-2 xl:grid-cols-3",
                  )}
                >
                  {options.slice(0, MAX_CARDS).map((m, i) => (
                    <OptionCard
                      key={m.tool.id}
                      match={m}
                      blockId={block.id}
                      anchorName={anchor?.name}
                      best={i === 0 && options.length > 1}
                      inKit={pieces[block.id] === m.tool.id}
                      index={i}
                      onToggle={() => toggleTool(m.tool.id, m.tool.name)}
                    />
                  ))}
                </ul>
                {options.length > MAX_CARDS ? (
                  <p className="text-center">
                    <Link href={`/block/${block.id}`} className="inline-flex min-h-11 items-center font-semibold">
                      See all {options.length} options
                    </Link>
                  </p>
                ) : null}
              </>
            ) : null}

            <nav
              aria-label="Move between jobs"
              className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"
            >
              <Button variant="ghost" disabled={step <= 0} onClick={() => go(ids[step - 1])}>
                <ArrowLeft aria-hidden className="size-4" />
                Previous
              </Button>
              <div className="flex flex-wrap gap-2">
                {open && !included ? (
                  <Button variant="secondary" onClick={skip}>
                    I&apos;m fine here
                  </Button>
                ) : null}
                <Button onClick={next}>
                  Next job
                  <ArrowRight aria-hidden className="size-4" />
                </Button>
              </div>
            </nav>
          </section>
        )}

        <p>
          <Link href="/board" className="font-semibold">
            See every job and every tool
          </Link>
        </p>
      </div>

      <div className="lg:sticky lg:top-20">
        <KitPanel kit={kit} focusId={current ?? undefined} onSelect={(id) => go(id)} />
      </div>
    </div>
  );
}
