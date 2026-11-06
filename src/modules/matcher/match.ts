import { evaluate, resolveAnchor } from "@/modules/compat-engine/engine";
import { DEFAULT_BUDGET, fitScore, type FitBreakdown } from "@/modules/fit-score/score";
import { toolCost, type ToolCost } from "@/modules/plan/cost";
import type { ArchetypeId, Block, BusinessProfile, Catalog, Tool, Verdict } from "@/modules/taxonomy/types";

/** Tool matcher (M7): candidates for a block, verdicts, groups and ranking. */

export type Match = {
  tool: Tool;
  verdict: Verdict;
  fit: FitBreakdown | null;
  cost: ToolCost;
};

export type AlreadyIncluded = {
  source: string;
  feature: string;
  addon_monthly_usd?: number;
  min_tier?: string;
  evidence_url?: string;
  verified: boolean;
  /** Present when the included feature is itself a catalog tool. */
  toolId?: string;
};

export type BlockResults = {
  included: AlreadyIncluded[];
  fits: Match[];
  catches: Match[];
  noFit: Match[];
  notAllowed: Match[];
  connectors: Match[];
  /** Base-system choices: other processors, or anchors when none exists yet (P1). */
  baseOptions: Match[];
  hiddenCount: number;
  /** Candidates filtered out by the active filters. */
  filteredCount: number;
};

export type Filters = {
  startFree?: boolean;
  underBudget?: boolean;
  noCode?: boolean;
  noTraining?: boolean;
};

function appliesToArchetypes(tool: Tool, archetypes: ArchetypeId[]): boolean {
  return tool.archetypes === "all" || tool.archetypes.some((a) => archetypes.includes(a));
}

export function passesFilters(m: Match, filters: Filters, profile: BusinessProfile): boolean {
  const budget = profile.monthly_budget_usd ?? DEFAULT_BUDGET;
  if (filters.startFree && !m.tool.free_tier && !m.cost.already_included) return false;
  if (filters.underBudget) {
    if (m.cost.monthly_usd === null) return false;
    if (m.cost.monthly_usd > budget) return false;
  }
  if (filters.noCode && !m.tool.setup.no_code) return false;
  if (filters.noTraining && m.tool.privacy.trains_on_customer_data !== false) return false;
  return true;
}

function toMatch(
  tool: Tool,
  profile: BusinessProfile,
  chosen: Tool[],
  catalog: Catalog,
): Match {
  const others = chosen.filter((t) => t.id !== tool.id);
  const verdict = evaluate(tool, profile, others, catalog);
  const cost = toolCost(tool, verdict, profile, catalog);
  return { tool, verdict, cost, fit: fitScore(tool, verdict, profile, cost.monthly_usd) };
}

const byScore = (a: Match, b: Match) => (b.fit?.total ?? 0) - (a.fit?.total ?? 0);

export function matchBlock(
  block: Block,
  profile: BusinessProfile,
  chosen: Tool[],
  catalog: Catalog,
  filters: Filters = {},
): BlockResults {
  const anchor = resolveAnchor(profile, catalog);
  const candidates = (catalog.toolsByBlock.get(block.id) ?? []).filter((t) =>
    appliesToArchetypes(t, profile.archetypes),
  );

  const matches = candidates
    .filter((t) => t.kind !== "base_system")
    .map((t) => toMatch(t, profile, chosen, catalog));

  const hiddenCount = matches.filter((m) => m.verdict.hidden).length;
  const visible = matches.filter((m) => !m.verdict.hidden);
  const aiTools = visible.filter((m) => m.tool.kind === "ai_tool");

  // P4: anything the anchor already covers is said first.
  const included: AlreadyIncluded[] = [];
  for (const c of anchor?.covers ?? []) {
    if (c.block !== block.id) continue;
    included.push({
      source: anchor?.name ?? "",
      feature: c.feature,
      addon_monthly_usd: c.addon_monthly_usd,
      min_tier: c.min_tier,
      evidence_url: c.evidence_url,
      verified: c.verified,
    });
  }
  for (const m of aiTools) {
    if (m.verdict.badges.includes("already_included")) {
      const reason = m.verdict.reasons.find((r) => r.rule === "R15");
      included.push({
        source: anchor?.name ?? "",
        feature: m.tool.name,
        addon_monthly_usd: m.cost.already_included
          ? undefined
          : (m.tool.tiers[0]?.monthly_usd ?? undefined),
        evidence_url: reason?.evidence_url,
        verified: m.tool.verified,
        toolId: m.tool.id,
      });
    }
  }

  const listable = aiTools.filter((m) => !m.verdict.badges.includes("already_included"));
  const passing = listable.filter((m) => passesFilters(m, filters, profile));
  const fitting = passing.filter(
    (m) => m.verdict.visible === "fits" || m.verdict.visible === "catch",
  );

  // R7: tell the owner what fits instead.
  const alternatives = [...fitting].sort(byScore).slice(0, 3).map((m) => m.tool.id);
  for (const m of passing) {
    if (m.verdict.visible === "no_fit") {
      m.verdict = { ...m.verdict, alternatives: alternatives.filter((id) => id !== m.tool.id) };
    }
  }

  // P1 exception and R1: base systems shown as choices, never ranked as recommendations.
  const baseOptions: Match[] = [];
  if (block.layer === "base") {
    for (const t of candidates) {
      if (t.kind !== "base_system" || t.id === anchor?.id) continue;
      const running = [
        profile.base.accounting,
        profile.base.customer_records,
        profile.base.payments_pos,
      ];
      if (running.includes(t.id)) continue;
      baseOptions.push(toMatch(t, profile, chosen, catalog));
    }
  }

  return {
    included,
    fits: passing.filter((m) => m.verdict.visible === "fits").sort(byScore),
    catches: passing.filter((m) => m.verdict.visible === "catch").sort(byScore),
    noFit: passing.filter((m) => m.verdict.visible === "no_fit"),
    notAllowed: passing.filter((m) => m.verdict.visible === "not_allowed"),
    connectors: visible.filter((m) => m.tool.kind === "adapter"),
    baseOptions,
    hiddenCount,
    filteredCount: listable.length - passing.length,
  };
}

/** Blocks shown on this business's board, in display order. */
export function blocksForProfile(profile: BusinessProfile, catalog: Catalog): Block[] {
  return catalog.blocks.filter((b) => {
    if (b.condition === "has_employees" && profile.employees <= 0) return false;
    if (b.condition === "multi_location" && profile.locations <= 1) return false;
    if (b.archetypes === "all") return true;
    return b.archetypes.some((a) => profile.archetypes.includes(a));
  });
}

/** Starter blocks across this business's archetypes, in order and without repeats. */
export function starterBlocks(profile: BusinessProfile, catalog: Catalog): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of profile.archetypes) {
    for (const block of catalog.archetypeById.get(id)?.starter_blocks ?? []) {
      if (!seen.has(block)) {
        seen.add(block);
        result.push(block);
      }
    }
  }
  return result;
}
