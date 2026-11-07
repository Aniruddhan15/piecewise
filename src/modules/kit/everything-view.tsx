"use client";

import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { useMemo } from "react";
import { chosenTools, useStore } from "@/modules/board/store";
import { blocksForProfile, matchBlock } from "@/modules/matcher/match";
import { catalog } from "@/modules/taxonomy/catalog";
import type { Block } from "@/modules/taxonomy/types";

type Row = { block: Block; status: string; count: number; done: boolean };

const HUB = new Set(["payments_pos", "customer_records", "channels"]);

/** Every job for this business that has at least one answer, as a plain list. */
export function EverythingView() {
  const { state } = useStore();
  const { profile, pieces } = state;

  const groups = useMemo(() => {
    const chosen = chosenTools(pieces);
    const rows: Row[] = [];
    for (const block of blocksForProfile(profile, catalog)) {
      if (HUB.has(block.id)) continue;
      const r = matchBlock(block, profile, chosen, catalog);
      const count = r.fits.length + r.catches.length;
      const placed = pieces[block.id] ? catalog.byId.get(pieces[block.id]) : undefined;
      const included = r.included[0];
      if (!placed && !included && count === 0) continue;
      rows.push({
        block,
        count,
        done: Boolean(placed || included),
        status: placed
          ? `In your kit: ${placed.name}`
          : included
            ? `Already included: ${included.feature}`
            : `${count} ${count === 1 ? "tool works" : "tools work"} for you`,
      });
    }
    return [
      { title: "For your line of work", rows: rows.filter((r) => r.block.layer === "archetype") },
      { title: "Every business", rows: rows.filter((r) => r.block.layer !== "archetype") },
    ].filter((g) => g.rows.length > 0);
  }, [profile, pieces]);

  return (
    <div className="space-y-8">
      <Link href="/matches" className="inline-flex min-h-11 items-center gap-1 font-semibold">
        <ArrowLeft aria-hidden className="size-4" />
        Back to my picks
      </Link>
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Every job, every tool</h1>
        <p className="max-w-2xl text-lg text-ink-2">
          Only jobs where something actually works for you are listed. You don&apos;t need all of
          them.
        </p>
      </header>
      {groups.map((g) => (
        <Reveal as="section" key={g.title} aria-labelledby={g.title} className="space-y-3">
          <h2 id={g.title} className="text-2xl font-extrabold">
            {g.title}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {g.rows.map((r) => (
              <li key={r.block.id}>
                <Link
                  href={`/block/${r.block.id}`}
                  className="flex min-h-16 items-center gap-4 px-5 py-3 text-ink no-underline hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className={
                      r.done
                        ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink"
                        : "flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ink-3"
                    }
                  >
                    {r.done ? <Check className="size-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold">{r.block.plain_name}</span>
                    <span className="block text-ink-2">{r.status}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-2" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  );
}
