/**
 * The jigsaw outline. Pieces share one shape (left and top notches, right and bottom
 * tabs) so they lock together in a grid. A mismatched tab is angular, so a poor fit
 * reads from shape as well as color (M5.F5, M16.F2).
 */

function outline(h: number, v: number, mismatch: boolean): string {
  const rightTab = mismatch
    ? `L100,42 L${100 + h},36 L${100 + h},64 L100,58`
    : `L100,38 C${100 + h * 0.2},38 ${100 + h * 1.15},36 ${100 + h},50 C${100 + h * 1.15},64 ${100 + h * 0.2},62 100,62`;
  return [
    "M0,0",
    `L38,0 C38,${v * 0.2} 36,${v * 1.15} 50,${v} C64,${v * 1.15} 62,${v * 0.2} 62,0`,
    "L100,0",
    rightTab,
    "L100,100",
    `L62,100 C62,${100 + v * 0.2} 64,${100 + v * 1.15} 50,${100 + v} C36,${100 + v * 1.15} 38,${100 + v * 0.2} 38,100`,
    "L0,100",
    `L0,62 C${h * 0.2},62 ${h * 1.15},64 ${h},50 C${h * 1.15},36 ${h * 0.2},38 0,38`,
    "Z",
  ].join(" ");
}

export function PieceShape({
  mismatch = false,
  dashed = false,
  heavy = false,
}: {
  mismatch?: boolean;
  dashed?: boolean;
  heavy?: boolean;
}) {
  const common = {
    fill: "var(--state-tint)",
    stroke: "var(--state-line)",
    strokeWidth: heavy ? 3 : 1.75,
    strokeDasharray: dashed ? "6 5" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <>
      {/* Wide cells take a shallower tab than narrow ones, so tabs look the same size. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 hidden size-full overflow-visible sm:block"
      >
        <path d={outline(7, 9, mismatch)} {...common} />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible sm:hidden"
      >
        <path d={outline(4, 7, mismatch)} {...common} />
      </svg>
    </>
  );
}
