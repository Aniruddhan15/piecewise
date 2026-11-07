import { evaluate, resolveAnchor } from "@/modules/compat-engine/engine";
import { blocksForProfile, matchBlock, starterBlocks, type Match } from "@/modules/matcher/match";
import type {
  AccountingEdition,
  ArchetypeId,
  Block,
  BusinessProfile,
  Catalog,
  Tool,
  VisibleState,
} from "@/modules/taxonomy/types";

/**
 * The kit (M13): the six jobs that matter most for this business, shown as a hexagon
 * that closes once every job has an answer. An answer can be a new tool, something the
 * business already has, or "I'm fine here", so a full kit never means buying six tools.
 */

export const KIT_SIZE = 6;

/** Base pieces live in the hub, not in a wedge. */
const HUB_BLOCKS = new Set(["payments_pos", "customer_records", "channels"]);

/** Jobs most owners care about, used to fill the kit after their own answers. */
const COMMON = ["customer_comm", "reviews", "marketing", "accounting", "scheduling_payroll"];

export type WedgeStatus = "added" | "included" | "have" | "skipped" | "next" | "locked";

export type Wedge = {
  block: Block;
  status: WedgeStatus;
  /** Tool or feature that covers this job. */
  label?: string;
  toolId?: string;
  visible?: VisibleState;
};

export type KitState = {
  hub?: Tool;
  wedges: Wedge[];
  covered: number;
  complete: boolean;
};

export type KitInput = {
  profile: BusinessProfile;
  pieces: Record<string, string>;
  pains: string[];
  skipped: string[];
};

function chosen(pieces: Record<string, string>, catalog: Catalog): Tool[] {
  return [...new Set(Object.values(pieces))]
    .map((id) => catalog.byId.get(id))
    .filter((t): t is Tool => Boolean(t));
}

/** True when at least one tool, or the main system, can do this job for this business. */
export function hasAnswer(block: Block, profile: BusinessProfile, catalog: Catalog): boolean {
  if (block.id === "accounting") return true;
  const r = matchBlock(block, profile, [], catalog);
  return r.fits.length + r.catches.length + r.included.length > 0;
}

/** The kit's jobs, in the order they unlock: the owner's own problems first. */
export function kitBlocks(input: KitInput, catalog: Catalog): Block[] {
  const { profile, pieces, pains } = input;
  const allowed = new Set(blocksForProfile(profile, catalog).map((b) => b.id));
  const order = [
    ...pains,
    ...Object.keys(pieces),
    ...starterBlocks(profile, catalog),
    ...COMMON,
    ...allowed,
  ];
  const result: Block[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (result.length >= KIT_SIZE) break;
    if (seen.has(id) || HUB_BLOCKS.has(id)) continue;
    seen.add(id);
    const block = catalog.blockById.get(id);
    if (!block) continue;
    // A job the owner named, or already filled, always gets a wedge.
    const named = pains.includes(id) || Boolean(pieces[id]);
    if (!named && !allowed.has(id)) continue;
    if (!named && !hasAnswer(block, profile, catalog)) continue;
    result.push(block);
  }
  return result;
}

export function kitState(input: KitInput, catalog: Catalog): KitState {
  const { profile, pieces, skipped } = input;
  const hub = resolveAnchor(profile, catalog);
  const tools = chosen(pieces, catalog);
  let nextGiven = false;

  const wedges = kitBlocks(input, catalog).map((block): Wedge => {
    const toolId = pieces[block.id];
    const tool = toolId ? catalog.byId.get(toolId) : undefined;
    if (tool) {
      const verdict = evaluate(
        tool,
        profile,
        tools.filter((t) => t.id !== tool.id),
        catalog,
      );
      return { block, status: "added", label: tool.name, toolId: tool.id, visible: verdict.visible };
    }
    const cover = hub?.covers?.find((c) => c.block === block.id);
    if (cover && hub) return { block, status: "included", label: `In ${hub.name}` };
    if (block.id === "accounting" && profile.base.accounting) {
      return { block, status: "have", label: catalog.byId.get(profile.base.accounting)?.name };
    }
    if (skipped.includes(block.id)) return { block, status: "skipped", label: "Handled" };
    if (!nextGiven) {
      nextGiven = true;
      return { block, status: "next" };
    }
    return { block, status: "locked" };
  });

  const covered = wedges.filter((w) => w.status !== "next" && w.status !== "locked").length;
  return { hub, wedges, covered, complete: wedges.length > 0 && covered === wedges.length };
}

// ---------- Picks ----------

export type Pick =
  | { kind: "tool"; block: Block; match: Match; added: boolean }
  | { kind: "included"; block: Block; feature: string; source: string; addonUsd?: number };

/** One best answer per job, for the owner's own problems first. */
export function topPicks(input: KitInput, catalog: Catalog, count = 3): Pick[] {
  const { profile, pieces } = input;
  const tools = chosen(pieces, catalog);
  const used = new Set(Object.values(pieces));
  const picks: Pick[] = [];

  for (const block of kitBlocks(input, catalog)) {
    if (picks.length >= count) break;
    if (input.skipped.includes(block.id)) continue;
    const r = matchBlock(block, profile, tools, catalog);
    const placed = pieces[block.id];
    if (placed) {
      const match = [...r.fits, ...r.catches, ...r.noFit, ...r.notAllowed].find(
        (m) => m.tool.id === placed,
      );
      // Something already fills this job (it may be a system, not a listed tool).
      if (match) picks.push({ kind: "tool", block, match, added: true });
      continue;
    }
    const included = r.included.find((i) => !i.toolId);
    if (included) {
      picks.push({
        kind: "included",
        block,
        feature: included.feature,
        source: included.source,
        addonUsd: included.addon_monthly_usd,
      });
      continue;
    }
    const best = [...r.fits, ...r.catches].find((m) => !used.has(m.tool.id));
    if (best) {
      used.add(best.tool.id);
      picks.push({ kind: "tool", block, match: best, added: false });
    }
  }
  return picks;
}

// ---------- Questions that change the answer ----------

export type QuestionOption = { value: string; label: string; hint?: string };

export type Question = {
  id: string;
  prompt: string;
  help?: string;
  options: QuestionOption[];
};

export const NOT_SURE = "__not_sure";
const PAPER = "__paper";

const BOOKS: { id: AccountingEdition; label: string; hint?: string }[] = [
  { id: "qbo", label: "QuickBooks Online", hint: "You sign in on a website" },
  { id: "qbd", label: "QuickBooks Desktop", hint: "A program on your office computer" },
  { id: "xero", label: "Xero" },
  { id: "wave", label: "Wave" },
  { id: "freshbooks", label: "FreshBooks" },
];

/** Puts a main system in place the same way the "This is what I use" button does. */
export function withCore(profile: BusinessProfile, toolId: string, catalog: Catalog): BusinessProfile {
  const tool = catalog.byId.get(toolId);
  const base = { ...profile.base };
  if (tool?.slots?.includes("payments_pos")) base.payments_pos = toolId;
  if (tool?.slots?.includes("customer_records")) base.customer_records = toolId;
  return { ...profile, base, anchor: toolId };
}

export function withBooks(profile: BusinessProfile, value: string): BusinessProfile {
  if (value === PAPER) {
    return { ...profile, base: { ...profile.base, accounting: undefined, accounting_edition: "spreadsheet" } };
  }
  return {
    ...profile,
    base: { ...profile.base, accounting: value, accounting_edition: value as AccountingEdition },
  };
}

function coreOptions(profile: BusinessProfile, catalog: Catalog): Tool[] {
  return catalog.tools.filter(
    (t) =>
      t.kind === "base_system" &&
      t.anchor_for?.some((a) => profile.archetypes.includes(a as ArchetypeId)),
  );
}

/** Every tool that could land in this kit, so we can tell if a fact moves any verdict. */
function kitCandidates(input: KitInput, catalog: Catalog): Tool[] {
  const ids = new Set<string>();
  for (const block of kitBlocks(input, catalog)) {
    for (const t of catalog.toolsByBlock.get(block.id) ?? []) {
      if (t.kind !== "ai_tool") continue;
      if (t.archetypes !== "all" && !t.archetypes.some((a) => input.profile.archetypes.includes(a))) continue;
      ids.add(t.id);
    }
  }
  return [...ids].map((id) => catalog.byId.get(id)).filter((t): t is Tool => Boolean(t));
}

function changesAnswer(
  variants: BusinessProfile[],
  input: KitInput,
  catalog: Catalog,
): boolean {
  const tools = kitCandidates(input, catalog);
  const placed = chosen(input.pieces, catalog);
  const signature = (p: BusinessProfile) =>
    tools
      .map((t) => {
        const v = evaluate(t, p, placed.filter((x) => x.id !== t.id), catalog);
        return v.hidden ? "hidden" : v.visible;
      })
      .join(",");
  return new Set(variants.map(signature)).size > 1;
}

/**
 * Only the questions whose answer would change a verdict in this kit, most important
 * first. The engine decides: we re-run it with each possible answer and compare.
 */
export function questionsThatMatter(
  input: KitInput,
  asked: string[],
  catalog: Catalog,
): Question[] {
  const { profile } = input;
  const questions: Question[] = [];

  if (!resolveAnchor(profile, catalog) && !asked.includes("core")) {
    const options = coreOptions(profile, catalog);
    if (options.length > 0 && changesAnswer(options.map((t) => withCore(profile, t.id, catalog)), input, catalog)) {
      const takesPayments = options.some((t) => t.slots?.includes("payments_pos"));
      questions.push({
        id: "core",
        prompt: takesPayments ? "How do you take payments?" : "What runs your bookings and client records?",
        help: "Most AI tools need to plug into this, so it changes which ones work for you.",
        options: [
          ...options.map((t) => ({ value: t.id, label: t.name })),
          { value: NOT_SURE, label: "Something else" },
        ],
      });
    }
  }

  const noBooks = !profile.base.accounting && !profile.base.accounting_edition;
  if (noBooks && !asked.includes("books")) {
    const variants = [...BOOKS.map((b) => withBooks(profile, b.id)), withBooks(profile, PAPER)];
    if (changesAnswer(variants, input, catalog)) {
      questions.push({
        id: "books",
        prompt: "What do you use for your books?",
        help: "Some tools only connect to one kind of QuickBooks, so this changes the answer.",
        options: [
          ...BOOKS.map((b) => ({ value: b.id, label: b.label, hint: b.hint })),
          { value: PAPER, label: "Paper or a spreadsheet" },
          { value: NOT_SURE, label: "Not sure" },
        ],
      });
    }
  }

  const regulated = profile.archetypes.flatMap(
    (id) => catalog.archetypeById.get(id)?.regulated_question ?? [],
  );
  for (const q of regulated) {
    if (profile.regulated !== "none" || asked.includes(`reg:${q.yes_value}`)) continue;
    const yes = { ...profile, regulated: q.yes_value };
    if (changesAnswer([profile, yes], input, catalog)) {
      questions.push({
        id: `reg:${q.yes_value}`,
        prompt: q.prompt,
        help: q.help,
        options: [
          { value: q.yes_value, label: "Yes" },
          { value: "none", label: "No" },
        ],
      });
    }
  }

  return questions;
}

/** Applies an answer to the profile. "Not sure" leaves it as it was. */
export function applyAnswer(
  profile: BusinessProfile,
  question: Question,
  value: string,
  catalog: Catalog,
): BusinessProfile {
  if (value === NOT_SURE) return profile;
  if (question.id === "core") return withCore(profile, value, catalog);
  if (question.id === "books") return withBooks(profile, value);
  if (question.id.startsWith("reg:")) {
    return { ...profile, regulated: value as BusinessProfile["regulated"] };
  }
  return profile;
}
