import { edgesBetween, resolveAnchor } from "@/modules/compat-engine/engine";
import type { BusinessProfile, Catalog, Tool, Verdict } from "@/modules/taxonomy/types";

/**
 * True cost (P3): the cheapest tier that includes the needed connection, not the
 * entry tier, plus adapters and fee penalties.
 */

export type CostLine = {
  label: string;
  monthly_usd: number | null;
  note?: string;
};

export type ToolCost = {
  tier?: string;
  /** Null when the vendor doesn't publish a price. */
  monthly_usd: number | null;
  lines: CostLine[];
  already_included: boolean;
};

/** Cheapest tier of `tool` that satisfies every connection it has to the systems you run. */
export function cheapestQualifyingTier(
  tool: Tool,
  profile: BusinessProfile,
  catalog: Catalog,
): string | undefined {
  if (tool.tiers.length === 0) return undefined;
  const selected = profile.selected_tiers[tool.id];
  let rank = selected ? Math.max(0, tool.tiers.findIndex((t) => t.name === selected)) : 0;

  const anchor = resolveAnchor(profile, catalog);
  const systems = [anchor?.id, profile.base.accounting, profile.base.payments_pos].filter(
    Boolean,
  ) as string[];
  for (const systemId of systems) {
    for (const edge of edgesBetween(tool.id, systemId, catalog)) {
      if (edge.status !== "active" || edge.type === "none") continue;
      const minTier = edge.from === tool.id ? edge.min_tier_from : edge.min_tier_to;
      if (minTier) {
        const need = tool.tiers.findIndex((t) => t.name === minTier);
        if (need > rank) rank = need;
      }
    }
  }
  return tool.tiers[rank]?.name;
}

export function toolCost(
  tool: Tool,
  verdict: Verdict,
  profile: BusinessProfile,
  catalog: Catalog,
): ToolCost {
  const anchor = resolveAnchor(profile, catalog);
  const coveredByTier = tool.included_in?.some((i) => {
    if (i.base_system !== anchor?.id) return false;
    if (!i.min_tier) return true;
    const owned = profile.selected_tiers[anchor.id];
    return (
      owned !== undefined &&
      anchor.tiers.findIndex((t) => t.name === owned) >=
        anchor.tiers.findIndex((t) => t.name === i.min_tier)
    );
  });

  if (coveredByTier) {
    return {
      monthly_usd: 0,
      lines: [{ label: `${tool.name} (already included)`, monthly_usd: 0 }],
      already_included: true,
    };
  }

  const tierName = cheapestQualifyingTier(tool, profile, catalog);
  const tier = tool.tiers.find((t) => t.name === tierName);
  const lines: CostLine[] = [
    {
      label: tier ? `${tool.name}: ${tier.name}` : tool.name,
      monthly_usd: tier?.monthly_usd ?? null,
      note: tier?.unit ? `per ${tier.unit}` : undefined,
    },
  ];

  if (verdict.adapter) {
    const adapter = catalog.byId.get(verdict.adapter);
    const free = adapter?.tiers.some((t) => t.monthly_usd === 0);
    lines.push({
      label: `${adapter?.name ?? "Connector"} to link them`,
      monthly_usd: verdict.extra_monthly_usd,
      note: free ? "free plan, slower updates" : undefined,
    });
  } else if (verdict.extra_monthly_usd > 0) {
    lines.push({
      label: verdict.required_tier ? `Upgrade to ${verdict.required_tier}` : "Extra fees",
      monthly_usd: verdict.extra_monthly_usd,
    });
  }

  const known = lines.every((l) => l.monthly_usd !== null);
  const total = known ? lines.reduce((sum, l) => sum + (l.monthly_usd ?? 0), 0) : null;
  return { tier: tierName, monthly_usd: total, lines, already_included: false };
}

export function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatUsd(value: number | null): string {
  if (value === null) return "Ask for a price";
  if (value === 0) return "$0";
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}
