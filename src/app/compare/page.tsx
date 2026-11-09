"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useMemo } from "react";
import { Button, ButtonLink, EmptyState, ExternalButton, PageTitle } from "@/components/ui";
import { chosenTools, useStore } from "@/modules/board/store";
import { RequireProfile } from "@/modules/board/store-gate";
import { StateBadge } from "@/modules/board/state-badge";
import { evaluate } from "@/modules/compat-engine/engine";
import { fitScore } from "@/modules/fit-score/score";
import { formatUsd, toolCost } from "@/modules/plan/cost";
import { catalog } from "@/modules/taxonomy/catalog";
import type { Tool } from "@/modules/taxonomy/types";
import { hiddenSpecLabels, specRows } from "@/modules/tool-start/summary";

function CompareTable() {
  const params = useSearchParams();
  const { state, setPiece } = useStore();
  const { profile, pieces } = state;
  const blockId = params.get("block") ?? "";
  const ids = (params.get("tools") ?? "").split(",").filter(Boolean).slice(0, 3);
  const chosen = useMemo(() => chosenTools(pieces), [pieces]);

  const rows = ids
    .map((id) => catalog.byId.get(id))
    .filter((t): t is Tool => Boolean(t))
    .map((tool) => {
      const verdict = evaluate(tool, profile, chosen.filter((c) => c.id !== tool.id), catalog);
      const cost = toolCost(tool, verdict, profile, catalog);
      return { tool, verdict, cost, fit: fitScore(tool, verdict, profile, cost.monthly_usd) };
    });

  if (rows.length === 0) {
    return (
      <EmptyState title="Pick tools to compare">
        <ButtonLink href="/matches" variant="secondary">
          Back to my picks
        </ButtonLink>
      </EmptyState>
    );
  }

  // The same rows for every tool; rows nobody has anything for are left out.
  const specs = rows.map((r) => specRows(r.tool, r.cost.tier));
  const hiddenSpecs = hiddenSpecLabels(specs);

  const row = (label: string, render: (r: (typeof rows)[number]) => React.ReactNode) => (
    <tr className="border-t border-line align-top">
      <th scope="row" className="sticky left-0 bg-surface p-3 text-left font-semibold">
        {label}
      </th>
      {rows.map((r) => (
        <td key={r.tool.id} className="min-w-44 p-3">
          {render(r)}
        </td>
      ))}
    </tr>
  );

  return (
    <>
      <Link href={blockId ? `/block/${blockId}` : "/matches"} className="mb-3 inline-flex min-h-11 items-center gap-1">
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>
      <PageTitle title="Compare side by side" />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface" tabIndex={0} role="region" aria-label="Comparison table">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <td className="p-3" />
              {rows.map((r) => (
                <th key={r.tool.id} scope="col" className="p-3 text-left text-lg font-bold">
                  {r.tool.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row("Fits your business?", (r) => <StateBadge state={r.verdict.visible} />)}
            {row("Why", (r) => r.verdict.reasons.find((x) => x.rule !== "OK")?.message ?? r.verdict.reasons[0]?.message ?? "No known conflicts.")}
            {row("What the AI does", (r) => r.tool.ai_capabilities.join(" "))}
            {row("Real monthly price", (r) => (
              <>
                <strong>{formatUsd(r.cost.monthly_usd)}</strong>
                <span className="block text-sm text-ink-2">{r.cost.lines.map((l) => l.label).join(" + ")}</span>
              </>
            ))}
            {/* The same four rows the option cards show, so every comparison lines up. */}
            {specs[0]
              .map((spec, i) => ({ label: spec.label, i }))
              .filter(({ label }) => !hiddenSpecs.has(label))
              .map(({ label, i }) => (
                <Fragment key={label}>
                  {row(label, (r) => {
                    const spec = specRows(r.tool, r.cost.tier)[i];
                    return spec.known ? spec.value : <em className="text-ink-2">{spec.value}</em>;
                  })}
                </Fragment>
              ))}
            {row("Contract", (r) => r.tool.contract_term ?? "None we know of")}
            {row("Fit score", (r) => (r.fit ? `${r.fit.total} out of 100` : "Not scored"))}
            {row("Facts checked?", (r) => (r.tool.verified ? "Verified against sources" : "Not double-checked yet"))}
            {row("Sources", (r) => (
              <ul className="space-y-1 text-sm">
                {r.tool.evidence.map((e) => (
                  <li key={e.claim}>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                      {e.claim}
                      <ExternalLink aria-hidden className="size-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            ))}
            {row("", (r) => (
              <div className="flex flex-col gap-2">
                {(r.verdict.visible === "fits" || r.verdict.visible === "catch") && blockId ? (
                  <Button size="sm" onClick={() => setPiece(blockId, r.tool.id)} disabled={pieces[blockId] === r.tool.id}>
                    {pieces[blockId] === r.tool.id ? "In my kit" : "Add to my kit"}
                  </Button>
                ) : null}
                <ExternalButton href={r.tool.how_to_start.url} variant="secondary" size="sm">
                  Vendor site
                </ExternalButton>
              </div>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ComparePage() {
  return (
    <RequireProfile>
      <Suspense fallback={null}>
        <CompareTable />
      </Suspense>
    </RequireProfile>
  );
}
