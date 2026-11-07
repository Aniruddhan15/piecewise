"use client";

import { ArrowRight, Check, Mic, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn, inputClass } from "@/components/ui";
import { emptyProfile, useStore } from "@/modules/board/store";
import { HexShape, type ShapeWedge } from "@/modules/kit/hex-kit";
import { hasAnswer } from "@/modules/kit/kit";
import { callTask } from "@/modules/llm/client-api";
import { mapProblemPayload } from "@/modules/llm/payloads";
import { blocksForProfile } from "@/modules/matcher/match";
import { keywordMap } from "@/modules/problem-mapper/keyword";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import type { ArchetypeId } from "@/modules/taxonomy/types";
import { ARCHETYPE_ICON } from "./icons";
import { painsFor } from "./pains";
import { useSpeech } from "./speech";

const TILE_COLORS = ["#0f7a5c", "#2463b0", "#a8550f", "#a83d62", "#5a4bb8", "#1d7c8c", "#0f7a5c", "#2463b0", "#a8550f"];

const MAX_PAINS = 3;

/** The hero picture: a kit filling itself in, piece by piece, then closing. */
function HeroShape() {
  const jobs = ["Answer calls", "Get reviews", "Staff schedule", "Your books", "Repeat visits", "Food costs"];
  const [step, setStep] = useState(jobs.length);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the loop from empty
    setStep(0);
    const id = window.setInterval(() => setStep((s) => (s >= jobs.length + 3 ? 0 : s + 1)), 900);
    return () => window.clearInterval(id);
  }, [jobs.length]);
  const wedges: ShapeWedge[] = jobs.map((title, i) => ({
    id: title,
    title,
    label: title,
    status: i < step ? "added" : i === step ? "next" : "locked",
    visible: i === 2 ? "catch" : "fits",
  }));
  return (
    <HexShape
      wedges={wedges}
      hubTitle="Your business"
      hubIcon={Store}
      complete={step >= jobs.length}
      className="mx-auto max-w-md drop-shadow-[0_24px_40px_rgb(15_29_24/0.12)]"
    />
  );
}

export function Finder() {
  const router = useRouter();
  const { ready, state, load, setSuggested } = useStore();
  const archetype = state.profile.archetypes[0] as ArchetypeId | undefined;
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const stepTwo = useRef<HTMLElement>(null);
  const speech = useSpeech((words) => setText((t) => (t ? `${t} ${words}` : words)));

  useEffect(() => {
    // Coming back to change answers: keep what they picked before.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore from saved state
    if (ready) setSelected(state.suggested ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const pains = useMemo(() => {
    if (!archetype) return [];
    const profile = state.profile;
    return painsFor([archetype]).filter((p) => {
      const block = catalog.blockById.get(p.block);
      return block ? hasAnswer(block, profile, catalog) : false;
    });
  }, [archetype, state.profile]);

  function chooseBusiness(id: ArchetypeId) {
    if (id !== archetype) {
      const a = catalog.archetypeById.get(id);
      load({
        profile: {
          ...emptyProfile,
          archetypes: [id],
          description: a?.examples[0] ?? a?.name ?? "",
          employees: 2,
          mobile: id === "field_services" || id === "construction",
        },
        pieces: {},
        suggested: [],
      });
      setSelected([]);
    }
    window.setTimeout(() => stepTwo.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function togglePain(block: string) {
    setSelected((list) =>
      list.includes(block)
        ? list.filter((b) => b !== block)
        : list.length < MAX_PAINS
          ? [...list, block]
          : list,
    );
  }

  async function showPicks() {
    let blocks = [...selected];
    if (text.trim()) {
      setBusy(true);
      const options = blocksForProfile(state.profile, catalog);
      const ai = await callTask<{ block_ids: string[] }>("map_problem", mapProblemPayload(text, options));
      const valid = ai?.block_ids.filter((id) => options.some((b) => b.id === id));
      const found = valid?.length ? valid : keywordMap(text, options).block_ids;
      blocks = [...new Set([...found, ...blocks])];
      setBusy(false);
    }
    setSuggested(blocks.slice(0, MAX_PAINS + 1));
    router.push("/matches");
  }

  const canGo = selected.length > 0 || text.trim().length > 2;

  return (
    <div className="space-y-16">
      <section className="dots -mx-4 -mt-6 grid items-center gap-8 px-4 pt-8 pb-4 sm:-mt-10 sm:pt-14 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold text-ink-2">
            <span aria-hidden className="size-2 rounded-full bg-honey" />
            Free · No sign-up · Nobody pays us to be listed
          </p>
          <h1 className="text-[2.6rem] leading-[1.02] font-extrabold sm:text-6xl">
            The AI tools worth it for <span className="text-brand">your</span> business.
          </h1>
          <p className="max-w-xl text-lg text-ink-2 sm:text-xl">
            Two taps. We&apos;ll show the tools that work with what you already use, what they really
            cost, and how to start.
          </p>
          <div className="space-y-3">
            <h2 className="text-lg font-bold">
              <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-ink text-sm text-bg">1</span>
              What kind of business do you run?
            </h2>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {catalog.archetypes.map((a, i) => {
                const Icon = ARCHETYPE_ICON[a.id] ?? Store;
                const on = archetype === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => chooseBusiness(a.id as ArchetypeId)}
                      className={cn(
                        "group flex h-full min-h-20 w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                        on ? "border-brand ring-2 ring-brand" : "border-line",
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ background: TILE_COLORS[i] }}
                      >
                        {on ? <Check className="size-5" /> : <Icon className="size-5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block leading-tight font-bold">{a.name}</span>
                        <span className="block text-sm leading-snug text-ink-2">{a.examples.slice(0, 2).join(", ")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="hidden lg:block">
          <HeroShape />
          <p className="mt-2 text-center text-sm text-ink-2">
            Each piece is a job in your business. Cover them all and your kit is complete.
          </p>
        </div>
      </section>

      {ready && archetype ? (
        <section ref={stepTwo} aria-labelledby="step-two" className="rise scroll-mt-24 space-y-5">
          <h2 id="step-two" className="text-2xl font-extrabold sm:text-3xl">
            <span className="mr-2 inline-flex size-8 items-center justify-center rounded-full bg-ink align-middle text-base text-bg">2</span>
            What&apos;s eating your time?
          </h2>
          <p className="text-ink-2">Tap up to {MAX_PAINS}. Or say it in your own words.</p>
          <ul className="flex flex-wrap gap-2.5">
            {pains.map((p) => {
              const on = selected.includes(p.block);
              return (
                <li key={p.block}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePain(p.block)}
                    disabled={!on && selected.length >= MAX_PAINS}
                    className={cn(
                      "flex min-h-12 items-center gap-2 rounded-full border px-4 py-2 text-left font-semibold transition-colors disabled:opacity-40",
                      on ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:border-ink-3",
                    )}
                  >
                    {on ? <Check aria-hidden className="size-4" /> : null}
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
            <label htmlFor="own-words" className="sr-only">
              Or describe it in your own words
            </label>
            <div className="relative flex-1">
              <input
                id="own-words"
                className={cn(inputClass, speech.supported && "pr-14")}
                placeholder="Or type it: “I spend Sundays doing payroll”"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canGo) void showPicks();
                }}
              />
              {speech.supported ? (
                <button
                  type="button"
                  onClick={speech.listening ? speech.stop : speech.start}
                  aria-pressed={speech.listening}
                  aria-label={speech.listening ? "Stop listening" : "Say it instead of typing"}
                  className={cn(
                    "absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg",
                    speech.listening ? "animate-pulse bg-honey text-ink" : "text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <Mic aria-hidden className="size-5" />
                </button>
              ) : null}
            </div>
          </div>
          <p role="status" className="sr-only">
            {speech.listening ? "Listening. Say what's eating your time." : ""}
          </p>
          <Button size="lg" disabled={!canGo || busy} onClick={() => void showPicks()}>
            {busy ? "Finding your picks…" : "Show my picks"}
            <ArrowRight aria-hidden className="size-5" />
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="examples" className="space-y-3 border-t border-line pt-8">
        <h2 id="examples" className="text-lg font-bold">
          Just looking? Open an example business
        </h2>
        <ul className="flex flex-wrap gap-2">
          {demos.map((d) => (
            <li key={d.id}>
              <Link
                href={`/matches?demo=${d.id}`}
                className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 font-semibold text-ink no-underline hover:border-ink-3"
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Why trust this" className="grid gap-4 sm:grid-cols-3">
        {[
          ["Checked against what you run", "A tool only shows as working if it really connects to your register, booking app or books."],
          ["Real prices, with sources", "The plan that includes the connection you need, not the cheapest teaser price."],
          ["Free advice nearby", "Every plan points you to free SBA advisors before you spend a dollar."],
        ].map(([title, body]) => (
          <div key={title} className="space-y-1">
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-ink-2">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
