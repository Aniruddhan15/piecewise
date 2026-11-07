import type { Match } from "@/modules/matcher/match";
import { formatUsd } from "@/modules/plan/cost";
import type { Tool } from "@/modules/taxonomy/types";

/**
 * The few facts an owner needs to choose a tool, in plain words. Shared by the option
 * cards and the tool page so they always say the same thing.
 */
export type ToolSummary = {
  /** What it does for you, in one line. */
  oneLiner: string;
  price: string;
  /** "a month · Essentials plan", "per location", and so on. */
  priceNote: string;
  /** "Works with Toast", or the catch. */
  fitLine: string;
  fitKind: "fits" | "catch" | "unknown";
  /** Up to three short points. */
  points: string[];
};

function trim(text: string, max = 70): string {
  const clean = text.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function summarize(match: Match, anchorName?: string): ToolSummary {
  const { tool, cost, verdict } = match;
  const tier = tool.tiers.find((t) => t.name === cost.tier);
  const price = cost.already_included
    ? "Included"
    : cost.monthly_usd === null
      ? "Ask for a price"
      : cost.monthly_usd === 0
        ? "Free"
        : formatUsd(cost.monthly_usd);
  const per = tier?.unit ? ` per ${tier.unit}` : "";
  const priceNote = cost.already_included
    ? `Comes with ${anchorName ?? "what you have"}`
    : cost.monthly_usd === null
      ? "The vendor quotes each business"
      : `a month${per}${cost.tier ? ` · ${cost.tier} plan` : ""}`;

  const fitKind = !anchorName ? "unknown" : verdict.visible === "fits" ? "fits" : "catch";
  const fitLine =
    fitKind === "unknown"
      ? "Tell us your main system to check the fit"
      : fitKind === "fits"
        ? `Works with ${anchorName}`
        : `Works with ${anchorName}, with a catch`;

  const points: string[] = [];
  // The first capability is already the one-liner, so the points start after it.
  const lead = tool.ai_capabilities[0] ? 1 : 0;
  for (const c of tool.ai_capabilities.slice(lead)) points.push(trim(c));
  for (const inc of (tier?.includes ?? []).slice(lead ? 0 : 1)) points.push(trim(inc));
  const setup = `About ${tool.setup.hours_estimate} ${tool.setup.hours_estimate === 1 ? "hour" : "hours"} to set up${tool.setup.no_code ? ", no coding" : ""}`;
  const trial = tool.trial_days ? `${tool.trial_days}-day free trial` : tool.free_tier ? "Has a free plan" : null;

  return {
    oneLiner: trim(tool.ai_capabilities[0] ?? tier?.includes[0] ?? tool.name, 90),
    price,
    priceNote,
    fitLine,
    fitKind,
    points: [...new Set([...points.slice(0, 2), setup, ...(trial ? [trial] : [])])].slice(0, 4),
  };
}

/** Steps to open an account, built from how this vendor lets people start. */
export function accountSteps(tool: Tool, opts: { anchorName?: string; tier?: string; jobName: string }): string[] {
  const vendor = vendorName(tool);
  if (tool.how_to_start.type === "marketplace_install") {
    return [
      `Open the ${opts.anchorName ?? "app"} marketplace, or use the button below.`,
      `Find ${tool.name} and choose Install.`,
      `Approve the connection when ${opts.anchorName ?? "it"} asks. That's what lets them share data.`,
    ];
  }
  if (tool.how_to_start.type === "book_demo") {
    return [
      `Go to ${vendor} and choose “Book a demo”.`,
      `Tell them you run ${opts.anchorName ?? "a small business"} and want help to ${opts.jobName.toLowerCase()}.`,
      "Ask for the full monthly price in writing before you sign anything.",
    ];
  }
  const steps = [
    `Go to ${vendor} and choose “Sign up” or “Start free”.`,
    "Use your business email, so it's easy to hand over later.",
  ];
  if (opts.tier) {
    steps.push(
      tool.tiers.find((t) => t.name === opts.tier)?.monthly_usd === 0
        ? `Start on the free ${opts.tier} plan. You can upgrade later.`
        : `Pick the ${opts.tier} plan: it's the one that includes what you need.`,
    );
  }
  if (tool.trial_days) {
    steps.push(`You get ${tool.trial_days} days free. Set a reminder for day ${Math.max(1, tool.trial_days - 2)} in case you don't want to keep it.`);
  }
  return steps;
}

export function vendorName(tool: Tool): string {
  try {
    return new URL(tool.vendor_url).hostname.replace(/^www\./, "");
  } catch {
    return tool.name;
  }
}
