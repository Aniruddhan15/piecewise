"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usd, type Payback } from "./outcomes";

/**
 * Charts for the plan: money gained month by month, and which jobs the gain comes from. Marks use the
 * app's own tokens (gray for "before", brand for "after"), text always wears ink tokens,
 * and every chart has its numbers printed or in a table so color is never the only channel.
 */

const AFTER = "var(--brand)";

/** Ranked horizontal bars, one hue, largest first. Each row names the job and its value. */
export function RankedBars({
  rows,
  caption,
}: {
  rows: { id: string; label: string; value: number; note?: string }[];
  caption: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  return (
    <figure className="space-y-3">
      <figcaption className="text-lg font-bold">{caption}</figcaption>
      <ul className="space-y-3">
        {sorted.map((r) => (
          <li key={r.id} title={`${r.label}: ${usd(r.value)} a month`}>
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{r.label}</span>
              <span className="font-bold">{usd(r.value)}</span>
            </p>
            <div className="mt-1 h-3.5">
              <div
                aria-hidden
                className="outcome-bar h-full rounded-r-md"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: AFTER }}
              />
            </div>
            {r.note ? <p className="mt-0.5 text-sm text-ink-2">{r.note}</p> : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---------- Payback line chart ----------

function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function compact(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 10000 ? `${Math.round(abs / 1000)}K` : abs >= 1000 ? `${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(Math.round(abs));
  return `${n < 0 ? "-" : ""}$${s}`;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Running total of what you gain after paying for the tools: a line for the middle estimate
 * and a soft band for the low-to-high range. Hover or arrow keys read any month.
 */
export function PaybackChart({ data, title }: { data: Payback; title: string }) {
  const [ref, width] = useWidth();
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const last = data.points[data.points.length - 1];

  const H = 270;
  const m = { top: 16, right: 20, bottom: 34, left: width < 420 ? 46 : 56 };
  const iw = width - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const lo = Math.min(0, ...data.points.map((p) => p.low));
  const hi = Math.max(1, ...data.points.map((p) => p.high));
  const step = niceStep(hi - lo, 4);
  // A tiny dip below zero (setup time) shouldn't stretch the axis down a whole step.
  const yMin = lo > -(hi - lo) * 0.04 ? 0 : Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const x = (month: number) => m.left + (month / (data.points.length - 1)) * iw;
  const y = (v: number) => m.top + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(v);
  const xTicks = data.points.filter((p) => p.month % 3 === 0);

  const line = data.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.month).toFixed(1)},${y(p.low).toFixed(1)}`).join(" ");
  const band =
    data.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.month).toFixed(1)},${y(p.high).toFixed(1)}`).join(" ") +
    " " +
    [...data.points]
      .reverse()
      .map((p) => `L${x(p.month).toFixed(1)},${y(p.low).toFixed(1)}`)
      .join(" ") +
    " Z";

  const shown = active === null ? null : data.points[active];

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - m.left) / iw;
    setActive(Math.max(0, Math.min(data.points.length - 1, Math.round(rel * (data.points.length - 1)))));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const n = data.points.length - 1;
    if (e.key === "ArrowRight") setActive((a) => Math.min(n, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? 1) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const be = data.breakEvenLow ?? data.breakEven;
  const summary = `${title}. After 12 months: at least ${usd(last.low)} on the cautious estimate, and up to ${usd(last.high)}.${
    be === null ? " It does not pay for itself within 12 months on these numbers." : be === 0 ? "" : ` It pays for itself in about ${be} months.`
  }`;

  const tipLeft = shown ? Math.min(Math.max(x(shown.month), 90), width - 90) : 0;

  return (
    <figure className="space-y-2">
      <figcaption className="text-lg font-bold">{title}</figcaption>
      <div
        ref={ref}
        className="relative touch-pan-y select-none"
        tabIndex={0}
        role="group"
        aria-label={`${summary} Use the left and right arrow keys to read each month.`}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={H} role="img" aria-label={summary} className="block overflow-visible">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={t === 0 ? 0 : 1} />
              <text x={m.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="var(--ink-2)" className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          <line x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeWidth={1} />
          {xTicks.map((p) => (
            <text key={p.month} x={x(p.month)} y={H - 10} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
              {p.month === 0 ? "Start" : `${p.month} mo`}
            </text>
          ))}

          <path d={band} fill="var(--brand)" opacity={0.14} />
          <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {be !== null && be > 0 ? (
            <circle cx={x(be)} cy={y(0)} r={5} fill="var(--honey)" stroke="var(--surface)" strokeWidth={2} />
          ) : null}

          {shown ? (
            <g>
              <line x1={x(shown.month)} x2={x(shown.month)} y1={m.top} y2={H - m.bottom} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={x(shown.month)} cy={y(shown.low)} r={5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          ) : (
            <circle cx={x(last.month)} cy={y(last.low)} r={5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
          )}
          {!shown ? (
            <text
              x={x(last.month) - 10}
              y={y(last.low) - 12}
              textAnchor="end"
              fontSize={14}
              fontWeight={700}
              fill="var(--ink)"
              className="tabular-nums"
            >
              {usd(last.low)}
            </text>
          ) : null}
        </svg>

        {shown ? (
          <div
            className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-xl border border-line bg-surface p-2.5 text-sm shadow-lg"
            style={{ left: tipLeft, top: 0 }}
          >
            <p className="font-bold">{shown.month === 0 ? "At the start" : `After ${shown.month} ${shown.month === 1 ? "month" : "months"}`}</p>
            <p>
              At least <strong>{usd(shown.low)}</strong>
            </p>
            <p className="text-ink-2">Could be up to {usd(shown.high)}</p>
          </div>
        ) : null}
        <p role="status" aria-live="polite" className="sr-only">
          {shown ? `Month ${shown.month}: at least ${usd(shown.low)}, could be up to ${usd(shown.high)}.` : ""}
        </p>
      </div>

      <p aria-hidden className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: "var(--brand)" }} /> Cautious total
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm opacity-30" style={{ background: "var(--brand)" }} /> Could be up to
        </span>
        {be !== null && be > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--honey)" }} /> Pays for itself
          </span>
        ) : null}
      </p>

      <details>
        <summary className="min-h-11 cursor-pointer font-semibold" aria-controls={`${id}-table`}>
          See the numbers as a table
        </summary>
        <table id={`${id}-table`} className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-1.5 pr-3">Month</th>
              <th className="py-1.5 pr-3 text-right">Cautious</th>
              <th className="py-1.5 pr-3 text-right">Middle</th>
              <th className="py-1.5 text-right">Up to</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.points
              .filter((p) => p.month % 3 === 0 || p.month === 1)
              .map((p) => (
                <tr key={p.month} className="border-b border-line">
                  <td className="py-1.5 pr-3">{p.month === 0 ? "Start" : p.month}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold">{usd(p.low)}</td>
                  <td className="py-1.5 pr-3 text-right">{usd(p.mid)}</td>
                  <td className="py-1.5 text-right">{usd(p.high)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
