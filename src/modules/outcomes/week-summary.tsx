"use client";

import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import type { KitState } from "@/modules/kit/kit";
import type { ArchetypeId } from "@/modules/taxonomy/types";
import { PaybackChart, RankedBars } from "./charts";
import { ConfidenceChip, SourceLink } from "./confidence";
import {
  formatHours,
  impactOf,
  jobGain,
  outcomeFor,
  OVERLAP_FACTOR,
  payback,
  sourcesFor,
  usd,
  type Outcome,
} from "./outcomes";

/** Jobs the kit has a real answer for: a new tool, or something already included. */
export function coveredJobIds(kit: KitState): string[] {
  return kit.wedges.filter((w) => w.status === "added" || w.status === "included").map((w) => w.block.id);
}

/** One line for the kit panel: how many hours the picks so far give back. */
export function HoursBadge({ kit, archetypes }: { kit: KitState; archetypes: ArchetypeId[] }) {
  const total = impactOf(coveredJobIds(kit), archetypes);
  if (total.jobs === 0) return null;
  return (
    <p
      className="flex flex-wrap items-center justify-center gap-x-2 rounded-2xl bg-honey-tint px-3 py-2 text-center font-semibold"
      title="Our cautious estimate for a typical business like yours"
    >
      <Clock aria-hidden className="size-4 shrink-0" />
      About {formatHours(total.hours.mid)} hours per week saved
      {total.cash.low > 0 ? <span className="text-ink-2">· at least {usd(total.cash.low)} a month</span> : null}
    </p>
  );
}

function Kpi({ label, lead, value, note }: { label: string; lead?: string; value: string; note: string }) {
  return (
    <li className="space-y-1 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">{label}</p>
      <p className="font-display leading-none font-extrabold">
        {lead ? <span className="text-sm font-bold text-ink-2">{lead} </span> : null}
        <span className="text-4xl text-brand">{value}</span>
      </p>
      <p className="text-sm text-ink-2">{note}</p>
    </li>
  );
}

/** How a job's money reads in a list: the cautious figure, or nothing where we put none. */
function moneyLine(o: Outcome): string {
  if (!o.money) return "Lower risk, no dollar figure";
  return o.money.kind === "revenue"
    ? `At least ${usd(o.money.low)} a month in extra sales`
    : `At least ${usd(o.money.low)} a month less out`;
}

/** How the money total is built, in one honest sentence. */
function MoneyNote({ overlap, margin }: { overlap: number; margin: number }) {
  return (
    <>
      Extra sales are counted at a {Math.round(margin * 100)}% profit margin
      {overlap < 1 ? `, and because jobs overlap the total is cut by ${Math.round((1 - OVERLAP_FACTOR) * 100)}%` : ""}.
      The headline is the cautious end of our range.
    </>
  );
}

/** Where the numbers came from, with how far to trust each one. */
export function SourcesPanel({ ids, archetypes }: { ids: string[]; archetypes: ArchetypeId[] }) {
  const sources = sourcesFor(ids, archetypes);
  return (
    <details className="rounded-2xl bg-surface-2 p-3">
      <summary className="min-h-11 cursor-pointer font-semibold">Where these numbers come from</summary>
      <div className="mt-2 space-y-3 text-ink-2">
        <p>
          We link every figure we could back with a source and say how far to trust it. Anything not listed here is our
          own estimate with its assumption stated. We read summaries of these sources, so check the original before you
          rely on a number.
        </p>
        <ul className="space-y-3">
          {sources.map((src) => (
            <li key={src.url} className="space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <ConfidenceChip confidence={src.confidence} />
                <span className="text-sm">Used for: {src.supports.join(", ")}</span>
              </p>
              <p>
                <SourceLink source={src} />
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** What the kit costs against what it gives back, over a year, with the owner's own hourly value. */
export function ReturnPanel({
  kit,
  archetypes,
  monthlyCost,
  hasUnknownPrice,
  setupHours,
}: {
  kit: KitState;
  archetypes: ArchetypeId[];
  monthlyCost: number;
  hasUnknownPrice: boolean;
  setupHours: number;
}) {
  // Start by counting only extra profit and savings: the owner opts in to valuing their time.
  const [hourly, setHourly] = useState(0);
  const ids = useMemo(() => coveredJobIds(kit), [kit]);
  const total = useMemo(() => impactOf(ids, archetypes), [ids, archetypes]);
  const data = useMemo(
    () =>
      payback({
        cash: total.cash,
        hours: total.hours,
        hourlyValue: hourly,
        monthlyCost,
        setupHours,
      }),
    [total, hourly, monthlyCost, setupHours],
  );
  if (total.jobs === 0) return null;

  const rows = ids
    .map((id) => {
      const o = outcomeFor(id, archetypes);
      const w = kit.wedges.find((x) => x.block.id === id);
      if (!o || !w) return null;
      const time = o.hours[0] * 4.3 * hourly;
      const gain = jobGain(o).low * total.overlap;
      return {
        id,
        label: w.block.plain_name,
        value: Math.round(gain + time),
        note: [
          o.money ? moneyLine(o) : "",
          hourly > 0 ? `${formatHours(o.hours[0])}+ hours a week of your time` : "",
        ]
          .filter(Boolean)
          .join(", plus "),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.value > 0);

  const last = data.points[data.points.length - 1];
  const months = (n: number) => (n <= 1 ? "1 month" : `${Math.ceil(n)} months`);
  const pays =
    data.breakEvenLow !== null
      ? { text: data.breakEvenLow === 0 ? "Right away" : months(data.breakEvenLow), note: "on the cautious estimate" }
      : data.breakEven !== null
        ? { text: months(data.breakEven), note: "on the middle estimate. Not on the cautious one." }
        : { text: "Not within a year", note: "on these numbers" };

  return (
    <Card className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">Will it pay for itself?</h2>
        <p className="text-ink-2">
          What you gain after paying for the tools, over a year, starting from the cautious end of our range. Gains
          build up over the first three months while you learn the tools.
        </p>
      </div>

      <div className="space-y-2 rounded-2xl bg-surface-2 p-4">
        <label htmlFor="hourly" className="flex flex-wrap items-baseline justify-between gap-2 font-semibold">
          Want to count your own time too? What is an hour worth to you?
          <output htmlFor="hourly" className="font-display text-2xl font-extrabold text-brand">
            {hourly === 0 ? "Not counted" : `$${hourly} an hour`}
          </output>
        </label>
        <input
          id="hourly"
          type="range"
          min={0}
          max={100}
          step={5}
          value={hourly}
          onChange={(e) => setHourly(Number(e.target.value))}
          className="h-11 w-full cursor-pointer accent-[var(--brand)]"
          aria-describedby="hourly-help"
        />
        <p id="hourly-help" className="text-sm text-ink-2">
          At $0 we count only extra profit and savings. Slide it up to also count the hours you get back. Your own
          setup time is counted at the same rate.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="After a year"
          lead={last.low >= 0 ? "At least" : undefined}
          value={usd(last.low)}
          note={`gained after tool costs. Could be up to ${usd(last.high)}`}
        />
        <Kpi
          label="Tools cost"
          value={`${usd(monthlyCost)}${hasUnknownPrice ? "+" : ""}`}
          note="a month, paid to the vendors"
        />
        <Kpi label="Pays for itself in" value={pays.text} note={pays.note} />
      </ul>

      <PaybackChart data={data} title="Total gained so far, after paying for your tools" />

      {rows.length > 0 ? <RankedBars rows={rows} caption="Where the cautious gain comes from, each month" /> : null}

      <p className="text-sm text-ink-2">
        <MoneyNote overlap={total.overlap} margin={total.margin} /> These are projections from our estimates for a typical business, not
        guarantees. Real results depend on how you use the tools. If a tool&apos;s price is unknown, the real cost is
        higher.
      </p>
      <SourcesPanel ids={ids} archetypes={archetypes} />
    </Card>
  );
}
