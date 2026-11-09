import { rawData } from "@/modules/taxonomy/catalog";
import type { ArchetypeId, ImpactEntry, OutcomeEntry } from "@/modules/taxonomy/types";

/**
 * Before/after stories (M16). Pure lookups over data/outcomes.json (wording and hours) and
 * data/impact.json (money and one efficiency measure). Everything here is our estimate for a
 * typical small business, so the UI always labels it that way.
 *
 * Rules that keep the money honest:
 *  - Extra sales are counted at a profit margin, because a sale is not profit.
 *  - When several jobs add money they overlap (the same customer is helped by calls, reviews
 *    and marketing), so the total is discounted.
 *  - The headline is the cautious (low) end; the high end is shown as "up to".
 *  - Jobs whose value is avoiding problems carry no dollar figure at all.
 *  - Hours are discounted for overlap too, and capped at about half the admin time owners say
 *    they have, so a kit never claims more time back than there is to give.
 */

export type Measure = ImpactEntry["measure"];
export type Money = NonNullable<ImpactEntry["money"]>;

/**
 * Share of extra sales we count as money in your pocket. About the typical gross margin of US
 * restaurants (32%) and retailers (31 to 35%) in the NYU Stern (Damodaran) margin data.
 */
export const PROFIT_MARGIN = 0.3;
/** Construction runs on thinner margins (gross margin about 15% in the same data). */
export const MARGIN_BY_ARCHETYPE: Partial<Record<ArchetypeId, number>> = { construction: 0.15 };

/** Owners report spending about 16 hours a week on admin; we never claim more than half of it back. */
export const ADMIN_HOURS_CAP = 8;

export function marginFor(archetypes: ArchetypeId[]): number {
  for (const a of archetypes) {
    const m = MARGIN_BY_ARCHETYPE[a];
    if (m !== undefined) return m;
  }
  return PROFIT_MARGIN;
}

export type Confidence = "sourced" | "vendor" | "guess";
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  sourced: "Sourced",
  vendor: "Vendor claim",
  guess: "Our guess",
};
export const CONFIDENCE_HELP: Record<Confidence, string> = {
  sourced: "Backed by published research or an official benchmark.",
  vendor: "The best figure we found comes from a company that sells this kind of tool.",
  guess: "Our own estimate, with the assumption stated.",
};

/** Where the margin and the time cap come from, shown with every plan. */
export const GLOBAL_SOURCES = [
  {
    label: "NYU Stern (Damodaran) US margins by industry: gross margin 32% for restaurants, 33% for retail, 15% for construction",
    url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/margin.html",
    confidence: "sourced" as Confidence,
    supports: "Profit margin on extra sales",
  },
  {
    label: "Time etc survey of 251 US owners (run by a virtual-assistant company): about 36% of a 45-hour week goes to admin",
    url: "https://www.timeetc.com/resources/how-to-achieve-more/the-big-price-of-small-tasks-how-entrepreneurs-may-be-unwittingly-keeping-their-businesses-small",
    confidence: "vendor" as Confidence,
    supports: "Cap on hours back",
  },
];
/** What is left of the money total when more than one job adds money. */
export const OVERLAP_FACTOR = 0.75;

export type Outcome = {
  block: string;
  before: string;
  after: string;
  icon: string;
  /** Low and high estimate of hours back per week. */
  hours: [number, number];
  assumption: string;
  /** Null when we put no dollar figure on this job. */
  money: Money | null;
  measure: Measure;
  /** Share of extra sales counted as profit for this kind of business. */
  margin: number;
  /** Which number leads the card. Falls back to time when the job has no dollar figure. */
  headline: "time" | "money" | "measure";
};

export function outcomeFor(
  blockId: string,
  archetypes: ArchetypeId[],
  entries: OutcomeEntry[] = rawData.outcomes,
  impact: ImpactEntry[] = rawData.impact,
): Outcome | null {
  const base = entries.find((e) => e.block === blockId && !e.archetype);
  const extra = impact.find((i) => i.block === blockId);
  if (!base?.hours || !base.assumption || !extra) return null;
  const mine = entries.find((e) => e.block === blockId && e.archetype && archetypes.includes(e.archetype));
  const forType = archetypes.map((a) => extra.by_archetype?.[a]?.money).find(Boolean);
  return {
    block: blockId,
    before: mine?.before ?? base.before,
    after: mine?.after ?? base.after,
    icon: mine?.icon ?? base.icon ?? "sparkles",
    hours: mine?.hours ?? base.hours,
    assumption: mine?.assumption ?? base.assumption,
    money: forType ?? extra.money,
    measure: extra.measure,
    margin: marginFor(archetypes),
    headline: extra.headline === "money" && !(forType ?? extra.money) ? "time" : extra.headline,
  };
}

const half = (n: number) => Math.round(n * 2) / 2;
const tens = (n: number) => Math.round(n / 10) * 10;
const WEEKS_PER_MONTH = 4.3;

/** What one job puts in your pocket each month: profit on extra sales, or money not spent. */
export function jobGain(o: Outcome): { low: number; high: number } {
  if (!o.money) return { low: 0, high: 0 };
  const k = o.money.kind === "revenue" ? o.margin : 1;
  return { low: o.money.low * k, high: o.money.high * k };
}

export type Impact = {
  jobs: number;
  /** Jobs that carry a dollar figure. */
  moneyJobs: number;
  hours: { low: number; high: number; mid: number };
  /** Dollars a month in your pocket: profit on extra sales plus money not spent, after the overlap discount. */
  cash: { low: number; high: number; mid: number };
  /** Extra sales a month (before the profit margin), after the overlap discount. */
  sales: { low: number; high: number };
  /** The discount applied to the money total: 1 when only one job adds money. */
  overlap: number;
  /** Share of extra sales counted as profit. */
  margin: number;
  /** True when the hours total was scaled down to the cap. */
  hoursCapped: boolean;
};

/** Adds up the jobs a kit covers. Hours are rounded to halves, dollars to tens. */
export function impactOf(
  blockIds: string[],
  archetypes: ArchetypeId[],
  entries: OutcomeEntry[] = rawData.outcomes,
  impact: ImpactEntry[] = rawData.impact,
): Impact {
  let jobs = 0;
  let moneyJobs = 0;
  const hours = { low: 0, high: 0 };
  const gain = { low: 0, high: 0 };
  const sales = { low: 0, high: 0 };
  for (const id of new Set(blockIds)) {
    const o = outcomeFor(id, archetypes, entries, impact);
    if (!o) continue;
    jobs += 1;
    hours.low += o.hours[0];
    hours.high += o.hours[1];
    if (!o.money) continue;
    moneyJobs += 1;
    const g = jobGain(o);
    gain.low += g.low;
    gain.high += g.high;
    if (o.money.kind === "revenue") {
      sales.low += o.money.low;
      sales.high += o.money.high;
    }
  }
  const overlap = moneyJobs > 1 ? OVERLAP_FACTOR : 1;
  const low = tens(gain.low * overlap);
  const high = tens(gain.high * overlap);

  // Hours overlap too, and there is only so much admin time to give back.
  const hoursOverlap = jobs > 1 ? OVERLAP_FACTOR : 1;
  let hLow = hours.low * hoursOverlap;
  let hHigh = hours.high * hoursOverlap;
  let hoursCapped = false;
  if (hHigh > ADMIN_HOURS_CAP) {
    const k = ADMIN_HOURS_CAP / hHigh;
    hLow *= k;
    hHigh = ADMIN_HOURS_CAP;
    hoursCapped = true;
  }
  return {
    jobs,
    moneyJobs,
    hours: { low: half(hLow), high: half(hHigh), mid: half((hLow + hHigh) / 2) },
    cash: { low, high, mid: tens((low + high) / 2) },
    sales: { low: tens(sales.low * overlap), high: tens(sales.high * overlap) },
    overlap,
    margin: marginFor(archetypes),
    hoursCapped,
  };
}

export type SourceRef = {
  url: string;
  label: string;
  confidence: Confidence;
  /** Plain names of the jobs (or the rule) this source supports. */
  supports: string[];
};

/** Every source behind the numbers for these jobs, one row per link, with what it supports. */
export function sourcesFor(
  blockIds: string[],
  archetypes: ArchetypeId[],
  entries: OutcomeEntry[] = rawData.outcomes,
  impact: ImpactEntry[] = rawData.impact,
): SourceRef[] {
  const byUrl = new Map<string, SourceRef>();
  const add = (src: { url: string; label: string } | undefined, confidence: Confidence, supports: string) => {
    if (!src) return;
    const row = byUrl.get(src.url) ?? { url: src.url, label: src.label, confidence, supports: [] };
    if (!row.supports.includes(supports)) row.supports.push(supports);
    byUrl.set(src.url, row);
  };
  for (const id of new Set(blockIds)) {
    const o = outcomeFor(id, archetypes, entries, impact);
    const name = rawData.blocks.find((b) => b.id === id)?.plain_name ?? id;
    if (!o) continue;
    add(o.measure.source, o.measure.confidence, name);
    add(o.money?.source, o.money?.confidence ?? "guess", name);
  }
  for (const g of GLOBAL_SOURCES) add(g, g.confidence, g.supports);
  return [...byUrl.values()];
}

/** Kept for callers that only want hours. */
export type HoursBack = { low: number; high: number; mid: number; jobs: number };
export function hoursBack(
  blockIds: string[],
  archetypes: ArchetypeId[],
  entries: OutcomeEntry[] = rawData.outcomes,
  impact: ImpactEntry[] = rawData.impact,
): HoursBack {
  const t = impactOf(blockIds, archetypes, entries, impact);
  return { ...t.hours, jobs: t.jobs };
}

export function formatHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "3 to 6 hours" or "1 hour" when the range is a single number. */
export function hoursRange(low: number, high: number): string {
  const unit = high === 1 ? "hour" : "hours";
  return low === high ? `${formatHours(high)} ${unit}` : `${formatHours(low)} to ${formatHours(high)} hours`;
}

export function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/** A typical middle for a money range, rounded so it doesn't pretend to be exact. */
export function moneyMid(low: number, high: number): number {
  const mid = (low + high) / 2;
  const step = mid >= 500 ? 50 : 10;
  return Math.round(mid / step) * step;
}

export function formatMeasure(m: Measure, value: number): string {
  return `${value}${m.unit}`;
}

/** How much better the "after" is, in words: "38 points higher", "75% less". */
export function measureChange(m: Measure): string {
  const diff = Math.abs(m.after - m.before);
  if (m.unit === "%") return `${diff} ${diff === 1 ? "point" : "points"} ${m.better === "higher" ? "higher" : "lower"}`;
  if (m.better === "lower" && m.before > 0) return `${Math.round((diff / m.before) * 100)}% less`;
  if (m.before > 0) return `${Math.round((diff / m.before) * 100)}% more`;
  return `${diff} more`;
}

// ---------- Payback ----------

export type PaybackPoint = { month: number; low: number; mid: number; high: number };

export type Payback = {
  points: PaybackPoint[];
  /** Month the middle estimate stays positive from, or null if it never does within the window. */
  breakEven: number | null;
  /** The same for the cautious (low) estimate. */
  breakEvenLow: number | null;
  /** Monthly gain after costs once gains have built up, low / mid / high. */
  monthly: { low: number; mid: number; high: number };
};

/** Gains build up over the first few months while you learn the tools. */
export const RAMP_MONTHS = 3;

/** The month after which a line never drops below zero again, to a tenth of a month. */
function crossing(points: PaybackPoint[], key: "low" | "mid"): number | null {
  let lastNegative = -1;
  points.forEach((p, i) => {
    if (p[key] < 0) lastNegative = i;
  });
  if (lastNegative === -1) return 0;
  if (lastNegative === points.length - 1) return null;
  const a = points[lastNegative][key];
  const b = points[lastNegative + 1][key];
  return Math.ceil((lastNegative + -a / (b - a)) * 10) / 10;
}

/**
 * Cumulative money in minus money out, month by month. Money in is the cash estimate (already
 * profit, after the overlap discount) plus, if the owner chooses, their freed hours at an hourly
 * value, phased in over the first three months. Money out is the tools' monthly price from
 * month one, and the owner's own setup time at the same hourly value. Three lines: cautious,
 * middle and high. The honest answer is a range, and the cautious end leads.
 */
export function payback(args: {
  cash: { low: number; high: number };
  hours: { low: number; high: number };
  hourlyValue: number;
  monthlyCost: number;
  setupHours: number;
  months?: number;
}): Payback {
  const months = args.months ?? 12;
  const value = (h: number) => h * WEEKS_PER_MONTH * args.hourlyValue;
  const gainLow = args.cash.low + value(args.hours.low);
  const gainHigh = args.cash.high + value(args.hours.high);
  const start = -args.setupHours * args.hourlyValue || 0;
  const points: PaybackPoint[] = [{ month: 0, low: start, mid: start, high: start }];
  for (let m = 1; m <= months; m++) {
    const ramp = Math.min(1, m / RAMP_MONTHS);
    const prev = points[m - 1];
    points.push({
      month: m,
      low: prev.low + gainLow * ramp - args.monthlyCost,
      mid: prev.mid + ((gainLow + gainHigh) / 2) * ramp - args.monthlyCost,
      high: prev.high + gainHigh * ramp - args.monthlyCost,
    });
  }
  return {
    points,
    breakEven: crossing(points, "mid"),
    breakEvenLow: crossing(points, "low"),
    monthly: {
      low: gainLow - args.monthlyCost,
      mid: (gainLow + gainHigh) / 2 - args.monthlyCost,
      high: gainHigh - args.monthlyCost,
    },
  };
}
