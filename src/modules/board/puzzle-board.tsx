"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, GripVertical, Grid3x3, List, Lock, Search, ShieldAlert, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button, ButtonLink, Card, Chip, cn, inputClass } from "@/components/ui";
import {
  evaluate,
  evaluateSeams,
  resolveAnchor,
  worstVisible,
} from "@/modules/compat-engine/engine";
import { callTask } from "@/modules/llm/client-api";
import { mapProblemPayload } from "@/modules/llm/payloads";
import { blocksForProfile, matchBlock, starterBlocks } from "@/modules/matcher/match";
import { keywordMap } from "@/modules/problem-mapper/keyword";
import { catalog } from "@/modules/taxonomy/catalog";
import type { Block, BusinessProfile, Seam, Tool, VisibleState } from "@/modules/taxonomy/types";
import { PieceShape } from "./piece-shape";
import { SeamDialog } from "./seam-dialog";
import { STATE_INFO, StateBadge } from "./state-badge";
import { chosenTools, useStore } from "./store";

const CHANNEL_NAMES: Record<string, string> = {
  phone: "Phone",
  text: "Text",
  email: "Email",
  google_profile: "Google",
  social: "Social",
  website: "Website",
};

type PieceView = {
  block: Block;
  tool?: Tool;
  label?: string;
  isAnchor: boolean;
  /** Empty anchor slot: this business has no main system yet (M4.F3). */
  anchorGap: boolean;
  state: VisibleState | "empty" | "base";
  seams: Seam[];
  starter: number;
  hardToSwap: boolean;
  covered: boolean;
  /** Dashed "suggested" piece from the profiler, which the owner can remove (M3.F7). */
  suggested: boolean;
};

function buildPieces(
  profile: BusinessProfile,
  pieces: Record<string, string>,
  seams: Seam[],
  suggested: string[],
): PieceView[] {
  const anchor = resolveAnchor(profile, catalog);
  const starters = starterBlocks(profile, catalog);
  const chosen = chosenTools(pieces);

  // A system can fill two pieces (Jobber is both payments and records); list its seams once.
  const seamsShownFor = new Set<string>();

  const standard = blocksForProfile(profile, catalog);
  const standardIds = new Set(standard.map((b) => b.id));
  const extras = suggested
    .filter((id) => !standardIds.has(id))
    .map((id) => catalog.blockById.get(id))
    .filter((b): b is Block => Boolean(b));

  return [...standard, ...extras].map((block) => {
    let tool: Tool | undefined;
    let label: string | undefined;
    if (pieces[block.id]) tool = catalog.byId.get(pieces[block.id]);
    else if (block.id === "payments_pos" && profile.base.payments_pos)
      tool = catalog.byId.get(profile.base.payments_pos);
    else if (block.id === "customer_records" && profile.base.customer_records)
      tool = catalog.byId.get(profile.base.customer_records);
    else if (block.id === "accounting" && profile.base.accounting)
      tool = catalog.byId.get(profile.base.accounting);
    else if (block.id === "channels" && profile.base.channels.length > 0)
      label = profile.base.channels.map((c) => CHANNEL_NAMES[c] ?? c).join(", ");
    else if (block.id === "accounting" && profile.base.accounting_edition === "spreadsheet")
      label = "Paper or a spreadsheet";

    const isAnchor = Boolean(tool && tool.id === anchor?.id);
    const anchorGap =
      !anchor && (block.id === "customer_records" || block.id === "payments_pos") && !tool;
    const mine = tool ? seams.filter((s) => s.a === tool?.id || s.b === tool?.id) : [];
    // The anchor shows its links to other base systems; each tool's piece shows its own link back.
    const relevant = isAnchor
      ? mine.filter((s) => [s.a, s.b].every((id) => catalog.byId.get(id)?.kind === "base_system"))
      : mine;
    const visibleSeams = tool && seamsShownFor.has(tool.id) ? [] : relevant;
    if (tool) seamsShownFor.add(tool.id);
    let state: PieceView["state"] = "empty";
    if (tool) {
      const others = chosen.filter((t) => t.id !== tool?.id);
      const own = tool.kind === "base_system" ? [] : [evaluate(tool, profile, others, catalog).visible];
      const seamStates = relevant.map((s) => s.visible);
      const all = [...own, ...seamStates];
      state = all.length ? worstVisible(all) : "base";
      if (tool.kind === "base_system" && all.length === 0) state = "base";
    } else if (label) {
      state = "base";
    }

    return {
      block,
      tool,
      label,
      isAnchor,
      anchorGap,
      state,
      seams: visibleSeams,
      starter: starters.indexOf(block.id),
      hardToSwap: Boolean(tool?.contract_term) && isAnchor,
      covered: !tool && !label && (anchor?.covers?.some((c) => c.block === block.id) ?? false),
      suggested: !standardIds.has(block.id),
    };
  });
}

function otherName(seam: Seam, toolId: string): string {
  const other = seam.a === toolId ? seam.b : seam.a;
  return catalog.byId.get(other)?.name ?? other;
}

function SeamButton({
  seam,
  tool,
  onOpen,
}: {
  seam: Seam;
  tool: Tool;
  onOpen: (s: Seam) => void;
}) {
  const info = STATE_INFO[seam.visible];
  const Icon = info.icon;
  const name = otherName(seam, tool.id);
  return (
    <button
      type="button"
      onClick={() => onOpen(seam)}
      aria-label={`${tool.name} with ${name}: ${info.label}. Show reasons.`}
      className={cn(
        `state-${seam.visible}`,
        "relative z-10 flex min-h-11 w-full items-center gap-1.5 rounded-md border bg-surface px-2 py-1 text-left text-sm font-medium",
      )}
      style={{ color: "var(--state)", borderColor: "var(--state-line)" }}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{name}: {info.label}</span>
    </button>
  );
}

type DropEffect = { block: string; kind: "snap" | "no_snap" };

function PieceCard({
  piece,
  highlight,
  onSeam,
  effect,
  onDismiss,
}: {
  piece: PieceView;
  highlight?: string;
  onSeam: (s: Seam) => void;
  effect?: DropEffect["kind"];
  onDismiss: (blockId: string) => void;
}) {
  const { block, tool, label, state, starter } = piece;
  const { setNodeRef, isOver } = useDroppable({ id: block.id });
  const stacked = piece.seams.some((s) => s.state === "overlaps");
  const started = starter >= 0 && !tool && !label;
  const stateName =
    state === "empty" ? "Empty" : state === "base" ? "Already in place" : STATE_INFO[state].label;

  return (
    <li
      ref={setNodeRef}
      data-block={block.id}
      className={cn(
        `state-${state === "empty" ? "empty" : state === "base" ? "base" : state}`,
        "relative flex min-h-48 flex-col",
        effect === "snap" && "piece-snap",
        effect === "no_snap" && "piece-no-snap",
      )}
    >
      {stacked ? (
        <div aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 opacity-50">
          <PieceShape />
        </div>
      ) : null}
      <PieceShape
        mismatch={state === "no_fit"}
        dashed={state === "empty"}
        heavy={state === "not_allowed" || Boolean(highlight) || isOver}
      />
      <div className="relative flex flex-1 flex-col gap-2 px-7 py-6 sm:px-8 sm:py-7">
        {started ? (
          <span className="w-fit rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink">
            Start here{starter >= 0 ? ` · ${starter + 1}` : ""}
          </span>
        ) : null}
        {piece.suggested ? (
          <span className="flex w-fit items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-2 text-xs font-bold">
            Suggested for you
            <button
              type="button"
              onClick={() => onDismiss(block.id)}
              aria-label={`Remove the suggested piece: ${block.plain_name}`}
              className="relative z-10 flex size-7 items-center justify-center rounded-full hover:bg-surface-2"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ) : null}
        {piece.anchorGap ? (
          <span className="w-fit rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink">
            First piece
          </span>
        ) : null}
        <h3 className="text-lg font-bold">
          <Link
            href={`/block/${block.id}`}
            className="text-ink underline decoration-line underline-offset-4 hover:decoration-brand"
            aria-label={`${block.plain_name}. ${block.name}. ${stateName}${tool ? `. Using ${tool.name}` : ""}.`}
          >
            {block.plain_name}
          </Link>
        </h3>
        <p className="text-sm text-ink-2">{block.name}</p>

        {tool ? (
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            {tool.name}
            {piece.isAnchor ? <Chip className="text-xs">Main system</Chip> : null}
            {piece.hardToSwap ? (
              <Chip className="text-xs" title={tool.contract_term}>
                <Lock aria-hidden className="size-3" />
                Hard to swap later
              </Chip>
            ) : null}
          </p>
        ) : label ? (
          <p className="font-semibold">{label}</p>
        ) : piece.covered ? (
          <p className="text-sm font-medium">Already included in your main system</p>
        ) : (
          <p className="text-sm text-ink-2">Empty: tap to see options</p>
        )}

        {state === "not_allowed" ? (
          <p className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--state)" }}>
            <ShieldAlert aria-hidden className="size-4" />
            Not allowed
          </p>
        ) : null}

        {tool && piece.seams.length > 0 ? (
          <ul className="mt-auto space-y-1.5 pt-1">
            {piece.seams.map((s) => (
              <li key={`${s.a}-${s.b}`}>
                <SeamButton seam={s} tool={tool} onOpen={onSeam} />
              </li>
            ))}
          </ul>
        ) : null}

        {highlight ? (
          <p className="rounded-md bg-surface p-2 text-sm font-medium">
            <Sparkles aria-hidden className="mr-1 inline size-4 text-brand" />
            {highlight}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PieceGrid({
  title,
  intro,
  items,
  highlights,
  onSeam,
  effect,
  onDismiss,
}: {
  title: string;
  intro: string;
  items: PieceView[];
  highlights: Record<string, string>;
  onSeam: (s: Seam) => void;
  effect: DropEffect | null;
  onDismiss: (blockId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-ink-2">{intro}</p>
      </div>
      <ul className="grid auto-rows-fr grid-cols-1 pr-[4%] pb-[3%] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => (
          <PieceCard
            key={p.block.id}
            piece={p}
            highlight={highlights[p.block.id]}
            onSeam={onSeam}
            effect={effect?.block === p.block.id ? effect.kind : undefined}
            onDismiss={onDismiss}
          />
        ))}
      </ul>
    </section>
  );
}

/** The same information as the puzzle, with no shapes and no dragging (M5.F6). */
function PieceList({
  items,
  highlights,
  onSeam,
}: {
  items: PieceView[];
  highlights: Record<string, string>;
  onSeam: (s: Seam) => void;
}) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {items.map((p) => (
        <li key={p.block.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">
              <Link href={`/block/${p.block.id}`}>{p.block.plain_name}</Link>{" "}
              <span className="text-sm font-normal text-ink-2">({p.block.name})</span>
            </h3>
            {p.state === "empty" ? (
              <Chip>{p.starter >= 0 ? `Start here · ${p.starter + 1}` : "Empty"}</Chip>
            ) : p.state === "base" ? (
              <Chip>Already in place</Chip>
            ) : (
              <StateBadge state={p.state} />
            )}
          </div>
          <p>
            {p.tool?.name ?? p.label ?? (p.covered ? "Already included in your main system" : "No tool yet")}
            {p.isAnchor ? " (main system)" : ""}
            {p.hardToSwap ? ` · Hard to swap later: ${p.tool?.contract_term}` : ""}
          </p>
          {highlights[p.block.id] ? <p className="font-medium">{highlights[p.block.id]}</p> : null}
          {p.tool && p.seams.length > 0 ? (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {p.seams.map((s) => (
                <li key={`${s.a}-${s.b}`}>
                  <SeamButton seam={s} tool={p.tool as Tool} onOpen={onSeam} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DraggableTool({ tool }: { tool: Tool }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tool.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      aria-label={`Drag ${tool.name} onto a piece`}
      style={{ transform: CSS.Translate.toString(transform), touchAction: "none" }}
      className={cn(
        "relative flex min-h-11 cursor-grab items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold active:cursor-grabbing",
        isDragging && "z-30 shadow-lg",
      )}
    >
      <GripVertical aria-hidden className="size-4 text-ink-2" />
      {tool.name}
    </button>
  );
}

/** A few good options to try by dragging. Tapping a piece does the same job without dragging. */
function ToolTray({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <section aria-label="Tools to try" className="no-print z-20 space-y-2 rounded-xl border border-line bg-surface p-3 shadow-sm sm:sticky sm:top-2">
      <p className="font-semibold">
        Try a tool: drag it onto a piece
        <span className="font-normal text-ink-2"> (or tap the piece to see every option)</span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {tools.map((t) => (
          <li key={t.id}>
            <DraggableTool tool={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeadacheBox({
  blocks,
  onResult,
}: {
  blocks: Block[];
  onResult: (ids: string[], why: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    const ai = await callTask<{ block_ids: string[]; why: string }>(
      "map_problem",
      mapProblemPayload(text, blocks),
    );
    const valid = ai?.block_ids.filter((id) => blocks.some((b) => b.id === id)).slice(0, 3);
    const result = valid?.length ? { block_ids: valid, why: ai?.why ?? "" } : keywordMap(text, blocks);
    setBusy(false);
    setMessage(result.block_ids.length ? `We highlighted ${result.block_ids.length} ${result.block_ids.length === 1 ? "piece" : "pieces"} below.` : result.why);
    onResult(result.block_ids, result.why);
  }

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-2"
      >
        <label htmlFor="headache" className="block text-lg font-semibold">
          What&apos;s your biggest headache?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="headache"
            className={inputClass}
            placeholder="For example: I keep missing calls while I'm on a job"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={busy || !text.trim()} className="shrink-0">
            <Search aria-hidden className="size-4" />
            {busy ? "Looking…" : "Find the piece"}
          </Button>
        </div>
        <p role="status" className="min-h-6 text-sm text-ink-2">
          {message}
        </p>
      </form>
    </Card>
  );
}

export function PuzzleBoard() {
  const { state, setPiece, setSuggested } = useStore();
  const { profile, pieces } = state;
  const [view, setView] = useState<"puzzle" | "list">("puzzle");
  const [effect, setEffect] = useState<DropEffect | null>(null);
  const [dropMessage, setDropMessage] = useState("");
  const effectTimer = useRef<number | undefined>(undefined);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [openSeam, setOpenSeam] = useState<Seam | null>(null);
  const [highlights, setHighlights] = useState<Record<string, string>>({});

  const chosen = useMemo(() => chosenTools(pieces), [pieces]);
  const seams = useMemo(() => evaluateSeams(profile, chosen, catalog), [profile, chosen]);
  const suggested = useMemo(() => state.suggested ?? [], [state.suggested]);
  const items = useMemo(
    () => buildPieces(profile, pieces, seams, suggested),
    [profile, pieces, seams, suggested],
  );
  const blocks = useMemo(() => items.map((i) => i.block), [items]);
  const anchor = resolveAnchor(profile, catalog);
  const filled = Object.keys(pieces).length;

  const base = items.filter((i) => i.block.layer === "base");
  const trade = items.filter((i) => i.block.layer === "archetype");
  const universal = items.filter((i) => i.block.layer === "universal");
  const names = profile.archetypes.map((a) => catalog.archetypeById.get(a)?.name).join(" + ");
  const showHighlights = (ids: string[], why: string) =>
    setHighlights(Object.fromEntries(ids.map((id) => [id, why])));
  const dismissSuggested = (blockId: string) =>
    setSuggested(suggested.filter((id) => id !== blockId));

  // Top options for the empty pieces, starter pieces first.
  const trayTools = useMemo(() => {
    const placed = new Set(Object.values(pieces));
    const starters = starterBlocks(profile, catalog);
    const seen = new Set<string>();
    const result: Tool[] = [];
    for (const blockId of [...starters, ...blocks.map((b) => b.id)]) {
      if (pieces[blockId] || result.length >= 8) continue;
      const block = catalog.blockById.get(blockId);
      if (!block || block.layer === "base") continue;
      const r = matchBlock(block, profile, chosen, catalog);
      for (const m of [...r.fits, ...r.catches].slice(0, 2)) {
        if (!placed.has(m.tool.id) && !seen.has(m.tool.id)) {
          seen.add(m.tool.id);
          result.push(m.tool);
        }
      }
    }
    return result.slice(0, 8);
  }, [pieces, profile, blocks, chosen]);

  function flash(block: string, kind: DropEffect["kind"]) {
    setEffect({ block, kind });
    window.clearTimeout(effectTimer.current);
    effectTimer.current = window.setTimeout(() => setEffect(null), 700);
  }

  function handleDragEnd(event: DragEndEvent) {
    const blockId = event.over?.id;
    const tool = catalog.byId.get(String(event.active.id));
    if (!blockId || !tool) return;
    const block = catalog.blockById.get(String(blockId));
    if (!block) return;
    if (!tool.blocks.includes(block.id)) {
      const homes = tool.blocks.map((b) => catalog.blockById.get(b)?.plain_name).filter(Boolean);
      flash(block.id, "no_snap");
      setDropMessage(`${tool.name} doesn't go on "${block.plain_name}". Try: ${homes.join(", ")}.`);
      return;
    }
    const verdict = evaluate(tool, profile, chosen.filter((t) => t.id !== tool.id), catalog);
    if (verdict.visible === "no_fit" || verdict.visible === "not_allowed") {
      flash(block.id, "no_snap");
      setDropMessage(`${tool.name} didn't snap in: ${verdict.reasons[0]?.message ?? "it doesn't fit."}`);
      return;
    }
    setPiece(block.id, tool.id);
    flash(block.id, "snap");
    setDropMessage(
      verdict.visible === "fits"
        ? `${tool.name} snapped into "${block.plain_name}".`
        : `${tool.name} snapped into "${block.plain_name}", with a catch. Tap its label to see why.`,
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold sm:text-4xl">Your puzzle</h1>
          <p className="text-lg text-ink-2">
            {names}
            {anchor ? ` on ${anchor.name}` : ""}. Tap a piece to see what fits. Tap a colored label
            to see why.
          </p>
        </div>
        <div role="group" aria-label="Choose a view" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          <Button size="sm" variant={view === "puzzle" ? "primary" : "ghost"} aria-pressed={view === "puzzle"} onClick={() => setView("puzzle")}>
            <Grid3x3 aria-hidden className="size-4" /> Puzzle
          </Button>
          <Button size="sm" variant={view === "list" ? "primary" : "ghost"} aria-pressed={view === "list"} onClick={() => setView("list")}>
            <List aria-hidden className="size-4" /> List
          </Button>
        </div>
      </header>

      <HeadacheBox blocks={blocks} onResult={showHighlights} />

      <ul aria-label="What the colors mean" className="flex flex-wrap gap-2">
        {(["fits", "catch", "no_fit", "not_allowed"] as const).map((s) => (
          <li key={s}>
            <StateBadge state={s} />
          </li>
        ))}
      </ul>

      {view === "puzzle" ? (
        <DndContext id="puzzle-board" sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            <ToolTray tools={trayTools} />
            <p role="status" className="min-h-6 font-medium">
              {dropMessage}
            </p>
            <div className="space-y-8">
              <PieceGrid title="What you already run" intro="Your foundation. Everything else has to fit around it." items={base} highlights={highlights} onSeam={setOpenSeam} effect={effect} onDismiss={dismissSuggested} />
              <PieceGrid title={`Pieces for ${names}`} intro="The jobs that matter most in your line of work." items={trade} highlights={highlights} onSeam={setOpenSeam} effect={effect} onDismiss={dismissSuggested} />
              <PieceGrid title="Pieces every business has" intro="Common jobs where AI tools often help first." items={universal} highlights={highlights} onSeam={setOpenSeam} effect={effect} onDismiss={dismissSuggested} />
            </div>
          </div>
        </DndContext>
      ) : (
        <PieceList items={items} highlights={highlights} onSeam={setOpenSeam} />
      )}

      <div className="no-print sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
        <p className="font-medium">
          {filled === 0
            ? "Add one tool to a piece to build your plan."
            : `${filled} ${filled === 1 ? "piece" : "pieces"} filled`}
        </p>
        {filled > 0 ? (
          <ButtonLink href="/plan">
            See my plan
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        ) : null}
      </div>

      <SeamDialog
        seam={openSeam}
        profile={profile}
        pieces={pieces}
        onRemovePiece={(blockId) => {
          setPiece(blockId, null);
          setOpenSeam(null);
        }}
        onClose={() => setOpenSeam(null)}
      />
    </div>
  );
}
