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
  /** The same rows, in the same order, for every tool, so cards line up side by side. */
  specs: SpecRow[];
};

/** One comparable fact. `known: false` means we have nothing to say, and the card shows it plainly. */
export type SpecRow = { label: string; value: string; known: boolean };

const AUDIENCE = /\b(contacts?|profiles?|subscribers?|customers?|clients?|callers?|users?|employees?|locations?|seats?|patients?|listings?|properties|staff)\b/i;
const VOLUME = /\b(sends?|emails?|minutes?|calls?|messages?|texts?|sms|credits?|requests?|orders?|conversations?|invoices?|bookings?|reviews?|shipments?|labels?|transactions?|takeoffs?)\b/i;
const HAS_AMOUNT = /\d|unlimited/i;
// Price notes and plan notes are not allowances.
const NOT_AN_ALLOWANCE = /^(plus|billed|a \$|ask|see|part of|added to|reported|availability|priced)\b|reported|sources conflict|add-on/i;

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The first thing the plan includes that is an amount of the given kind, such as "250 contacts". */
function allowance(includes: string[], kind: RegExp, skip?: RegExp): string | null {
  for (const inc of includes) {
    const text = trim(inc, 44);
    if (!HAS_AMOUNT.test(text) || NOT_AN_ALLOWANCE.test(text)) continue;
    if (skip?.test(text)) continue;
    if (kind.test(text)) return sentence(text);
  }
  return null;
}

const NOT_LISTED = "Not listed";

/**
 * The same rows, in the same order, for every tool: how many people it covers, how much use it
 * includes, the contract, what happens to your data, setup time, and whether you can try it
 * free. A tool with nothing to say about a row still has the row ("Not listed"), so cards line
 * up. Use `hiddenSpecLabels` to drop rows that no card in a comparison has anything for.
 */
export function specRows(tool: Tool, tierName?: string): SpecRow[] {
  const includes = tool.tiers.find((t) => t.name === tierName)?.includes ?? tool.tiers[0]?.includes ?? [];
  const people = allowance(includes, AUDIENCE, VOLUME);
  const usage = allowance(includes, VOLUME);
  const hours = tool.setup.hours_estimate;
  const free = tool.free_tier ? "Free plan" : null;
  const trial = tool.trial_days ? `${tool.trial_days}-day free trial` : null;
  const trains = tool.privacy.trains_on_customer_data;
  return [
    { label: "People it covers", value: people ?? NOT_LISTED, known: people !== null },
    { label: "Use included", value: usage ?? NOT_LISTED, known: usage !== null },
    {
      label: "Contract",
      value: tool.contract_term ? sentence(trim(tool.contract_term, 44)) : "None we know of",
      known: Boolean(tool.contract_term),
    },
    {
      label: "Your data",
      value: trains === null ? "Not confirmed" : trains ? "May train its AI on it" : "Not used to train its AI",
      known: trains !== null,
    },
    {
      label: "Setup time",
      value: `About ${hours} ${hours === 1 ? "hour" : "hours"}${tool.setup.no_code ? ", no coding" : ""}`,
      known: true,
    },
    { label: "Try it free", value: [free, trial].filter(Boolean).join(" and ") || "None we could confirm", known: true },
  ];
}

/**
 * Rows to leave out of a comparison: the ones where not a single tool has anything to show.
 * Hiding them for every card at once keeps the cards symmetric without a column of blanks.
 */
export function hiddenSpecLabels(all: SpecRow[][]): Set<string> {
  const hidden = new Set<string>();
  if (all.length === 0) return hidden;
  for (const [i, row] of all[0].entries()) {
    if (all.every((rows) => !rows[i]?.known)) hidden.add(row.label);
  }
  return hidden;
}

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

  return {
    oneLiner: trim(tool.ai_capabilities[0] ?? tier?.includes[0] ?? tool.name, 90),
    price,
    priceNote,
    fitLine,
    fitKind,
    specs: specRows(tool, cost.tier),
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
