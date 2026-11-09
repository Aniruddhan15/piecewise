"use client";

import { Check, Lock, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import type { VisibleState } from "@/modules/taxonomy/types";
import type { KitState, WedgeStatus } from "./kit";

/**
 * The kit shape: one wedge per job around the business at the center. Wedges unlock one
 * after another, link to the hub and to their neighbors as they're covered, and the
 * outline closes once every job has an answer. It's a picture: the list next to it
 * carries the same information for screen readers and keyboards.
 */

export type ShapeWedge = {
  id: string;
  title: string;
  status: WedgeStatus;
  label?: string;
  visible?: VisibleState;
  /** The job the owner is looking at right now. */
  focused?: boolean;
};

const COLORS = ["#0f7a5c", "#2463b0", "#a8550f", "#a83d62", "#5a4bb8", "#1d7c8c"];

const R_OUT = 112;
const R_IN = 42;

function point(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  // Rounded so the server and browser render the same numbers.
  return [Math.round(r * Math.cos(rad) * 10) / 10, Math.round(r * Math.sin(rad) * 10) / 10];
}

function shrink(points: [number, number][], by: number): [number, number][] {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map(([x, y]) => [cx + (x - cx) * by, cy + (y - cy) * by]);
}

const fmt = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

const LINE_HEIGHT = 10.5;

/**
 * Wraps a label into up to three short lines that fit inside a piece. Nothing is cut off
 * unless the label is very long; then the last line ends with an ellipsis.
 */
function lines(text: string, max = 12, maxLines = 3): string[] {
  const words = text.split(" ");
  const out: string[] = [""];
  for (const w of words) {
    const cur = out[out.length - 1];
    if (!cur) out[out.length - 1] = w;
    else if ((cur + " " + w).length <= max) out[out.length - 1] = `${cur} ${w}`;
    else if (out.length < maxLines) out.push(w);
    else {
      out[out.length - 1] = `${cur} ${w}`;
    }
  }
  const last = out.length - 1;
  if (out[last].length > max + 2) out[last] = `${out[last].slice(0, max)}…`;
  return out;
}

const covered = (s: WedgeStatus) => s !== "next" && s !== "locked";

export function HexShape({
  wedges,
  hubTitle,
  hubIcon: HubIcon,
  complete,
  onSelect,
  className,
  style,
}: {
  wedges: ShapeWedge[];
  hubTitle: string;
  hubIcon?: LucideIcon;
  complete: boolean;
  onSelect?: (id: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const n = Math.max(3, wedges.length);
  const step = 360 / n;
  const start = -90 - step / 2;
  const outline = Array.from({ length: n }, (_, k) => point(R_OUT + 6, start + k * step));
  // The hub is a small circle: wrap its name to two short lines instead of cutting it off.
  const hubLines = lines(hubTitle, 10, 2);

  return (
    <svg
      viewBox="-130 -130 260 260"
      aria-hidden
      className={cn("kit-shape block h-auto w-full", complete && "kit-complete", className)}
      style={style}
    >
      <defs>
        <pattern id="kit-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--surface-2)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" strokeWidth="2.5" />
        </pattern>
        <radialGradient id="kit-glow">
          <stop offset="0%" stopColor="var(--honey)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--honey)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {complete ? <circle r="128" fill="url(#kit-glow)" className="kit-halo" /> : null}

      {wedges.map((w, k) => {
        const a0 = start + k * step;
        const a1 = a0 + step;
        const pts = shrink([point(R_IN, a0), point(R_OUT, a0), point(R_OUT, a1), point(R_IN, a1)], 0.93);
        // The label's centre is the piece's own centre (leaning a little outward, where it is wider).
        const meanX = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
        const meanY = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
        const mid = ((a0 + step / 2) * Math.PI) / 180;
        const lx = Math.round((meanX + 3 * Math.cos(mid)) * 10) / 10;
        const ly = Math.round((meanY + 3 * Math.sin(mid)) * 10) / 10;
        const color = COLORS[k % COLORS.length];
        const isNew = w.status === "added";
        const fill =
          w.status === "added"
            ? color
            : w.status === "included" || w.status === "have"
              ? color
              : w.status === "skipped"
                ? "url(#kit-hatch)"
                : w.status === "next"
                  ? "var(--honey-tint)"
                  : "var(--surface)";
        const textColor = isNew ? "#ffffff" : w.status === "locked" ? "var(--ink-3)" : "var(--ink)";
        const title = lines(w.status === "added" || w.status === "have" ? (w.label ?? w.title) : w.title);
        const sub = w.status === "next" ? "up next" : "";
        // Stack the lock or check, the name and the tag, and centre the whole stack in the piece.
        const hasIcon = w.status === "locked" || (covered(w.status) && w.status !== "skipped");
        const iconH = hasIcon ? 15 : 0;
        const stackH = iconH + title.length * LINE_HEIGHT + (sub ? 11 : 0);
        const stackTop = ly - stackH / 2;
        const firstLine = stackTop + iconH + 8;
        const lastLine = firstLine + (title.length - 1) * LINE_HEIGHT;
        const [ix, iy] = point(R_IN - 2, a0 + step / 2);
        const [hx, hy] = point(30, a0 + step / 2);
        return (
          <g
            key={`${w.id}-${w.status}`}
            className={cn("kit-wedge", `kit-${w.status}`, onSelect && "cursor-pointer")}
            style={{ animationDelay: `${k * 70}ms` }}
            onClick={onSelect ? () => onSelect(w.id) : undefined}
          >
            <polygon
              points={fmt(pts)}
              fill={fill}
              fillOpacity={w.status === "included" || w.status === "have" ? 0.2 : 1}
              stroke={
                w.status === "next"
                  ? "var(--honey)"
                  : w.status === "locked"
                    ? "var(--line)"
                    : w.status === "added"
                      ? color
                      : w.status === "skipped"
                        ? "var(--line)"
                        : color
              }
              strokeWidth={w.status === "next" ? 2.5 : 1.5}
              strokeLinejoin="round"
              className="kit-tile"
            />
            {w.focused && covered(w.status) ? (
              <polygon points={fmt(pts)} fill="none" stroke="var(--honey)" strokeWidth={3.5} strokeLinejoin="round" />
            ) : null}
            {covered(w.status) ? (
              <line
                x1={hx}
                y1={hy}
                x2={ix}
                y2={iy}
                stroke={w.visible === "catch" ? "var(--honey)" : color}
                strokeWidth="3"
                strokeLinecap="round"
                pathLength={1}
                className="kit-link"
              />
            ) : null}
            {w.status === "locked" ? (
              <Lock x={lx - 6} y={stackTop} width={12} height={12} color="var(--ink-3)" strokeWidth={2.2} />
            ) : covered(w.status) && w.status !== "skipped" ? (
              <Check x={lx - 6} y={stackTop} width={12} height={12} color={isNew ? "#ffffff" : color} strokeWidth={3} />
            ) : null}
            <text x={lx} y={firstLine} textAnchor="middle" fill={textColor} className="kit-label">
              {title.map((t, i) => (
                <tspan key={i} x={lx} dy={i === 0 ? 0 : LINE_HEIGHT}>
                  {t}
                </tspan>
              ))}
            </text>
            {sub ? (
              <text
                x={lx}
                y={lastLine + 10}
                textAnchor="middle"
                fill={isNew ? "rgba(255,255,255,0.85)" : "var(--ink-2)"}
                className="kit-sub"
              >
                {sub}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Seams: a bright link between neighbors once both are covered. */}
      {wedges.map((w, k) => {
        const next = wedges[(k + 1) % wedges.length];
        if (!next || wedges.length < 2 || !covered(w.status) || !covered(next.status)) return null;
        const a = start + (k + 1) * step;
        const [x1, y1] = point(R_IN + 8, a);
        const [x2, y2] = point(R_OUT - 8, a);
        return (
          <line
            key={`seam-${w.id}-${next.id}-${w.status}-${next.status}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--honey)"
            strokeWidth="3.5"
            strokeLinecap="round"
            pathLength={1}
            className="kit-seam"
          />
        );
      })}

      {complete ? (
        <polygon
          points={fmt(outline)}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinejoin="round"
          pathLength={1}
          className="kit-outline"
        />
      ) : null}

      <g className="kit-hub">
        <circle r="31" fill={complete ? "#0b5c47" : "var(--hub)"} />
        <circle r="31" fill="none" stroke="var(--honey)" strokeWidth={complete ? 3 : 0} />
        {complete ? (
          <Check x={-10} y={-25} width={20} height={20} color="var(--honey)" strokeWidth={3} />
        ) : HubIcon ? (
          <HubIcon x={-9} y={-25} width={18} height={18} color="var(--honey)" strokeWidth={2} />
        ) : null}
        <text y="4" textAnchor="middle" fill="#ffffff" className="kit-hub-label">
          {hubLines.map((t, i) => (
            <tspan key={i} x="0" dy={i === 0 ? 0 : 10}>
              {t}
            </tspan>
          ))}
        </text>
      </g>
    </svg>
  );
}

/** Shape data for a kit. With `focusId`, the job being looked at is the one that glows. */
export function shapeFromKit(kit: KitState, focusId?: string): ShapeWedge[] {
  return kit.wedges.map((w) => {
    const open = w.status === "next" || w.status === "locked";
    const status = open && focusId ? (w.block.id === focusId ? "next" : "locked") : w.status;
    return {
      id: w.block.id,
      title: w.block.name,
      status,
      label: w.label,
      visible: w.visible,
      focused: w.block.id === focusId,
    };
  });
}
