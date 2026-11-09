"use client";

import { ArrowRight, Check, Minus, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { cn } from "@/components/ui";
import type { Match } from "@/modules/matcher/match";
import { summarize } from "./summary";

const TONES = ["var(--tone-1)", "var(--tone-2)", "var(--tone-3)"];

/**
 * One tool as a tall, simple card: name, one line, price, two buttons, then a short
 * checklist. Every card has the same shape, so options are easy to compare at a glance.
 */
export function OptionCard({
  match,
  blockId,
  anchorName,
  best,
  inKit,
  index,
  onToggle,
  hiddenSpecs,
}: {
  match: Match;
  blockId: string;
  anchorName?: string;
  best: boolean;
  inKit: boolean;
  index: number;
  /** Rows no card in this comparison has anything for, left out of every card so they stay level. */
  hiddenSpecs?: ReadonlySet<string>;
  /** Adds the tool to the kit, or takes it out again. */
  onToggle: () => void;
}) {
  const s = summarize(match, anchorName);
  const href = `/tool/${match.tool.id}?block=${blockId}`;

  return (
    <Reveal as="li" delay={index * 90} className="flex flex-col">
      <div
        aria-hidden={!best}
        className={cn(
          "mx-auto h-9 w-[86%] rounded-t-2xl text-center font-display leading-9 font-bold",
          best ? "bg-honey text-[#10241d]" : "invisible",
        )}
      >
        {best ? "Best match for you" : ""}
      </div>
      <article className="lift flex flex-1 flex-col overflow-hidden rounded-3xl border border-line">
        <div
          className={cn("space-y-5 p-6", best ? "text-white" : "text-ink")}
          style={{ background: best ? "var(--best-bg)" : TONES[index % TONES.length] }}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-3xl font-extrabold">{match.tool.name}</h3>
            {inKit ? (
              <span className={cn("mt-1.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", best ? "bg-white/20" : "bg-surface")}>
                <Check aria-hidden className="size-3.5" />
                In your kit
              </span>
            ) : null}
          </div>
          {/* The price leads: it is the first thing an owner compares. */}
          <div className={cn("rounded-2xl p-4", best ? "bg-white/10" : "bg-surface/70")}>
            <p
              className={cn(
                "font-display leading-none font-extrabold break-words",
                // Short prices ($49, Free) are shown huge; a phrase ("Ask for a price") has to fit the card.
                s.price.length > 9 ? "text-3xl" : "text-5xl",
              )}
            >
              {s.price}
            </p>
            <p className={cn("mt-2 text-base font-semibold", best ? "text-white/90" : "text-ink-2")}>{s.priceNote}</p>
            {s.fitKind !== "unknown" ? (
              <p className="mt-2 flex min-h-[2.6em] items-start gap-1 text-sm font-bold">
                {s.fitKind === "catch" ? <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
                {s.fitLine}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={inKit}
              className={cn(
                "flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-semibold transition-transform hover:scale-[1.02]",
                inKit
                  ? best
                    ? "bg-white/15 text-white ring-2 ring-white/60"
                    : "bg-surface text-ink ring-2 ring-ink"
                  : best
                    ? "bg-honey text-[#10241d]"
                    : "bg-ink text-bg",
              )}
            >
              {inKit ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
              {inKit ? "In my kit" : "Add to my kit"}
              <span className="sr-only">: {match.tool.name}</span>
            </button>
            <Link
              href={href}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-full border-2 px-5 font-semibold no-underline transition-colors",
                best ? "border-white/70 text-white hover:bg-white/10" : "border-ink/25 text-ink hover:border-ink",
              )}
            >
              See how it works
              <span className="sr-only"> for {match.tool.name}</span>
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
        <div className="flex-1 space-y-3 bg-surface p-6">
          <p className="font-bold">What you get</p>
          <dl className="space-y-2">
            {s.specs.filter((row) => !hiddenSpecs?.has(row.label)).map((row) => (
              <div key={row.label} className="min-h-[4.25rem]">
                <dt className="flex items-center gap-2.5 text-xs font-bold tracking-wide text-ink-2 uppercase">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      row.known ? "bg-ink text-bg" : "border border-line text-ink-2",
                    )}
                  >
                    {row.known ? <Check className="size-3" strokeWidth={3} /> : <Minus className="size-3" strokeWidth={3} />}
                  </span>
                  {row.label}
                </dt>
                <dd className={cn("line-clamp-2 pl-[1.875rem]", row.known ? "text-ink" : "text-ink-2 italic")}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>
    </Reveal>
  );
}
