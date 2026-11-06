import type { BusinessProfile, Tool, Verdict } from "@/modules/taxonomy/types";

/** Fit score (M9). Weights live in one object so they can be tuned in one place. */
export const FIT_WEIGHTS = {
  integration: 0.3,
  setup: 0.2,
  cost: 0.2,
  industry: 0.15,
  trust: 0.15,
} as const;

export const DEFAULT_BUDGET = 200;

export type FitBreakdown = {
  integration: number;
  setup: number;
  cost: number;
  industry: number;
  trust: number;
  total: number;
  over_budget: boolean;
};

export function integrationScore(verdict: Verdict): number {
  if (verdict.visible === "fits") return 100;
  if (verdict.state === "needs_upgrade") return 50;
  return 70;
}

export function setupScore(tool: Tool): number {
  const { hours_estimate: hours, no_code: noCode } = tool.setup;
  if (noCode && hours <= 1) return 100;
  if (hours <= 4) return 80;
  if (hours <= 8) return 60;
  return 30;
}

export function costScore(
  monthlyUsd: number | null,
  budget: number,
  freeTier: boolean,
): { score: number; over: boolean } {
  if (freeTier && (monthlyUsd === 0 || monthlyUsd === null)) return { score: 100, over: false };
  // No published price: we can't say it fits, and won't punish it as over budget.
  if (monthlyUsd === null) return { score: 50, over: false };
  if (monthlyUsd === 0) return { score: 100, over: false };
  if (monthlyUsd <= budget * 0.25) return { score: 90, over: false };
  if (monthlyUsd <= budget * 0.5) return { score: 70, over: false };
  if (monthlyUsd <= budget) return { score: 50, over: false };
  return { score: 10, over: true };
}

export function industryScore(tool: Tool, profile: BusinessProfile): number {
  if (tool.archetypes === "all") return 60;
  return profile.archetypes.some((a) => (tool.archetypes as string[]).includes(a)) ? 100 : 60;
}

export function trustScore(tool: Tool): number {
  const best = tool.evidence.reduce((min, e) => Math.min(min, e.grade), 6);
  const evidence = (60 * (6 - best)) / 5;
  const trains = tool.privacy.trains_on_customer_data;
  const privacy = trains === false ? 40 : trains === null ? 20 : 0;
  return Math.round(evidence + privacy);
}

/**
 * Score for tools whose visible state is fits or catch. `monthlyUsd` is the true
 * monthly cost from plan/cost.ts: cheapest qualifying tier plus adapters and fees.
 */
export function fitScore(
  tool: Tool,
  verdict: Verdict,
  profile: BusinessProfile,
  monthlyUsd: number | null,
): FitBreakdown | null {
  if (verdict.visible !== "fits" && verdict.visible !== "catch") return null;
  const budget = profile.monthly_budget_usd ?? DEFAULT_BUDGET;
  const integration = integrationScore(verdict);
  const setup = setupScore(tool);
  const { score: cost, over } = costScore(monthlyUsd, budget, tool.free_tier);
  const industry = industryScore(tool, profile);
  const trust = trustScore(tool);
  const total = Math.round(
    integration * FIT_WEIGHTS.integration +
      setup * FIT_WEIGHTS.setup +
      cost * FIT_WEIGHTS.cost +
      industry * FIT_WEIGHTS.industry +
      trust * FIT_WEIGHTS.trust,
  );
  return { integration, setup, cost, industry, trust, total, over_budget: over };
}
