"use client";

import { ArrowRight, Check, Plus, TriangleAlert } from "lucide-react";
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
}: {
  match: Match;
  blockId: string;
  anchorName?: string;
  best: boolean;
  inKit: boolean;
  index: number;
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
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-3xl font-extrabold">{match.tool.name}</h3>
              {inKit ? (
                <span className={cn("mt-1.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", best ? "bg-white/20" : "bg-surface")}>
                  <Check aria-hidden className="size-3.5" />
                  In your kit
                </span>
              ) : null}
            </div>
            <p className={cn("line-clamp-3 min-h-[4.7em]", best ? "text-white/85" : "text-ink-2")}>{s.oneLiner}</p>
          </div>
          <div>
            <p className="font-display text-3xl font-extrabold">{s.price}</p>
            <p className={cn("text-sm", best ? "text-white/85" : "text-ink-2")}>{s.priceNote}</p>
            <p className="mt-1 flex min-h-[2.6em] items-start gap-1 text-sm font-bold">
              {s.fitKind === "catch" ? <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : s.fitKind === "fits" ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" /> : null}
              {s.fitLine}
            </p>
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
          <ul className="space-y-2.5">
            {s.points.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-bg">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-ink-2">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </Reveal>
  );
}
