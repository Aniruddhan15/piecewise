"use client";

import { ArrowRight, Check, Lock, Undo2 } from "lucide-react";
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
      return "Not started yet";
  }
}

function LegendRow({
  w,
  index,
  current,
  onSelect,
}: {
  w: Wedge;
  index: number;
  current: boolean;
  onSelect: (id: string) => void;
}) {
  const { setPiece, toggleSkipped } = useStore();
  const open = w.status === "next" || w.status === "locked";
  return (
    <li className={cn("flex items-center gap-2 rounded-xl", current && "bg-honey-tint ring-2 ring-honey")}>
      <button
        type="button"
        onClick={() => onSelect(w.block.id)}
        aria-current={current ? "step" : undefined}
        className="flex min-h-14 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ background: open ? (current ? "var(--honey)" : "var(--ink-3)") : DOTS[index % DOTS.length] }}
        >
          {open ? current ? index + 1 : <Lock className="size-3.5" /> : <Check className="size-4" />}
        </span>
        <span className="min-w-0">
          <span className="block leading-tight font-semibold">{w.block.plain_name}</span>
          <span className="block text-sm text-ink-2">{current && open ? "You're here" : statusText(w)}</span>
        </span>
      </button>
      {w.status === "skipped" ? (
        <button
          type="button"
          onClick={() => toggleSkipped(w.block.id)}
          aria-label={`Undo: ${w.block.plain_name}`}
          className="mr-1 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
        >
          <Undo2 aria-hidden className="size-3.5" />
          Undo
        </button>
      ) : w.status === "added" ? (
        <button
          type="button"
          onClick={() => setPiece(w.block.id, null)}
          aria-label={`Remove ${w.label} from my kit`}
          className="mr-1 min-h-11 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}

/** The kit as a shape plus the same facts as a list. Tapping a job jumps to it. */
export function KitPanel({
  kit,
  focusId,
  onSelect,
}: {
  kit: KitState;
  focusId?: string;
  onSelect: (id: string) => void;
}) {
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
        wedges={shapeFromKit(kit, focusId)}
        hubTitle={hubTitle}
        hubIcon={HubIcon}
        complete={kit.complete}
        onSelect={onSelect}
        className="mx-auto max-w-[19rem]"
      />
      <p className="text-center font-semibold">
        {kit.complete
          ? "Complete! Every job has an answer."
          : n - kit.covered === 1
            ? "One more piece closes the shape."
            : `${n - kit.covered} pieces to go.`}
      </p>
      <ol className="space-y-1">
        {kit.wedges.map((w, i) => (
          <LegendRow key={w.block.id} w={w} index={i} current={w.block.id === focusId} onSelect={onSelect} />
        ))}
      </ol>
      {added > 0 ? (
        <ButtonLink href="/plan" variant={kit.complete ? "primary" : "secondary"} className="w-full">
          See my plan
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      ) : null}
    </section>
  );
}
