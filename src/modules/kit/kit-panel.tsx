"use client";

import { ArrowRight, Check, Lock, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink, cn } from "@/components/ui";
import { useStore } from "@/modules/board/store";
import { ARCHETYPE_ICON } from "@/modules/finder/icons";
import { catalog } from "@/modules/taxonomy/catalog";
import { HexShape, shapeFromKit } from "./hex-kit";
import type { KitState, Wedge } from "./kit";

const DOTS = ["#0f7a5c", "#2463b0", "#a8550f", "#a83d62", "#5a4bb8", "#1d7c8c"];

function statusText(w: Wedge): string {
  switch (w.status) {
    case "added":
      return w.visible === "catch" ? `${w.label}, with a catch` : `${w.label}`;
    case "included":
      return `Already included: ${w.label?.replace(/^In /, "")}`;
    case "have":
      return `Already yours: ${w.label}`;
    case "skipped":
      return "You're fine here";
    case "next":
      return "Up next";
    default:
      return "Unlocks after the one above";
  }
}

function LegendRow({ w, index }: { w: Wedge; index: number }) {
  const { setPiece, toggleSkipped } = useStore();
  const open = w.status === "next" || w.status === "locked";
  return (
    <li className={cn("flex items-start gap-3 py-2.5", w.status === "locked" && "opacity-75")}>
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ background: open ? "var(--ink-3)" : DOTS[index % DOTS.length] }}
      >
        {w.status === "locked" ? <Lock className="size-3.5" /> : open ? index + 1 : <Check className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="leading-tight font-semibold">
          <Link href={`/block/${w.block.id}`} className="text-ink">
            {w.block.plain_name}
          </Link>
        </p>
        <p className="text-sm text-ink-2">{statusText(w)}</p>
        {open ? (
          <div className="mt-1 flex flex-wrap gap-x-3">
            <Link href={`/block/${w.block.id}`} className="inline-flex min-h-9 items-center text-sm font-semibold">
              See options
            </Link>
            <button
              type="button"
              onClick={() => toggleSkipped(w.block.id)}
              className="inline-flex min-h-9 items-center text-sm font-semibold text-ink-2 underline underline-offset-4"
            >
              I&apos;m fine here
            </button>
          </div>
        ) : w.status === "skipped" ? (
          <button
            type="button"
            onClick={() => toggleSkipped(w.block.id)}
            className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink-2"
          >
            <Undo2 aria-hidden className="size-3.5" />
            Undo
          </button>
        ) : w.status === "added" ? (
          <button
            type="button"
            onClick={() => setPiece(w.block.id, null)}
            className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-ink-2 underline underline-offset-4"
          >
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** The kit as a shape plus the same facts as a list. */
export function KitPanel({ kit, showCta = true }: { kit: KitState; showCta?: boolean }) {
  const router = useRouter();
  const { state } = useStore();
  const archetype = state.profile.archetypes[0];
  const HubIcon = archetype ? ARCHETYPE_ICON[archetype] : undefined;
  const hubTitle = kit.hub?.name ?? catalog.archetypeById.get(archetype)?.examples[0] ?? "You";
  const n = kit.wedges.length;
  const added = Object.keys(state.pieces).length;

  return (
    <section aria-labelledby="kit-title" className="space-y-4 rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="kit-title" className="text-xl font-extrabold">
          Your kit
        </h2>
        <p className="text-sm font-semibold text-ink-2">
          {kit.covered} of {n} covered
        </p>
      </div>
      <HexShape
        wedges={shapeFromKit(kit)}
        hubTitle={hubTitle}
        hubIcon={HubIcon}
        complete={kit.complete}
        onSelect={(id) => router.push(`/block/${id}`)}
        className="mx-auto max-w-[19rem]"
      />
      <p role="status" className="text-center font-semibold">
        {kit.complete
          ? "Complete! Every job has an answer."
          : n - kit.covered === 1
            ? "One more piece closes the shape."
            : `${n - kit.covered} pieces to go. Each one unlocks the next.`}
      </p>
      <ol className="divide-y divide-line">
        {kit.wedges.map((w, i) => (
          <LegendRow key={w.block.id} w={w} index={i} />
        ))}
      </ol>
      {showCta && added > 0 ? (
        <ButtonLink href="/plan" className="w-full">
          See my plan
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      ) : null}
    </section>
  );
}
