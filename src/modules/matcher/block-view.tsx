"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, ButtonLink, Card, EmptyState } from "@/components/ui";
import { chosenTools, useStore } from "@/modules/board/store";
import { ReasonList } from "@/modules/board/seam-dialog";
import { StateBadge } from "@/modules/board/state-badge";
import { resolveAnchor } from "@/modules/compat-engine/engine";
import { SbaHint } from "@/modules/sba/sba-panel";
import { catalog } from "@/modules/taxonomy/catalog";
import type { AccountingEdition } from "@/modules/taxonomy/types";
import { ToolCard } from "@/modules/tool-card/tool-card";
import { formatUsd } from "@/modules/plan/cost";
import { matchBlock, type Filters, type Match } from "./match";

const FILTERS: { key: keyof Filters; label: string; help?: string }[] = [
  { key: "startFree", label: "Start free" },
  { key: "underBudget", label: "Under budget" },
  { key: "noCode", label: "No coding" },
  { key: "noTraining", label: "Doesn't train AI on my data", help: "Only shows tools whose policy we confirmed." },
];

const MAX_COMPARE = 3;

export function BlockView({ blockId }: { blockId: string }) {
  const { state, setPiece, setProfile } = useStore();
  const { profile, pieces } = state;
  const [filters, setFilters] = useState<Filters>({});
  const [compare, setCompare] = useState<string[]>([]);
  const block = catalog.blockById.get(blockId);
  const anchor = resolveAnchor(profile, catalog);

  const chosen = useMemo(() => chosenTools(pieces), [pieces]);
  const results = useMemo(
    () => (block ? matchBlock(block, profile, chosen, catalog, filters) : null),
    [block, profile, chosen, filters],
  );

  if (!block || !results) {
    return (
      <EmptyState title="We don't have that piece">
        <ButtonLink href="/board" variant="secondary">
          Back to my puzzle
        </ButtonLink>
      </EmptyState>
    );
  }

  const current = pieces[block.id];
  const toggleCompare = (id: string) =>
    setCompare((list) =>
      list.includes(id)
        ? list.filter((x) => x !== id)
        : list.length < MAX_COMPARE
          ? [...list, id]
          : list,
    );

  const card = (m: Match, explain: boolean) => (
    <li key={m.tool.id}>
      <ToolCard
        match={m}
        profile={profile}
        chosen={current === m.tool.id}
        comparing={compare.includes(m.tool.id)}
        explain={explain}
        onToggle={() => setPiece(block.id, current === m.tool.id ? null : m.tool.id)}
        onCompare={() => toggleCompare(m.tool.id)}
      />
    </li>
  );

  const nothingFits =
    results.fits.length === 0 && results.catches.length === 0 && results.included.length === 0;
  const processorLocked = block.id === "payments_pos" && anchor?.requires_processor;
  const needsAnchor = !anchor && (block.id === "payments_pos" || block.id === "customer_records");
  const needsAccounting = block.id === "accounting" && !profile.base.accounting;
  const baseChoices = results.baseOptions.filter((m) =>
    needsAnchor
      ? m.tool.anchor_for?.some((a) => profile.archetypes.includes(a))
      : needsAccounting || processorLocked,
  );

  function chooseBase(toolId: string) {
    setProfile((p) => {
      const tool = catalog.byId.get(toolId);
      if (block?.id === "accounting") {
        return {
          ...p,
          base: { ...p.base, accounting: toolId, accounting_edition: toolId as AccountingEdition },
        };
      }
      const base = { ...p.base };
      if (tool?.slots?.includes("payments_pos")) base.payments_pos = toolId;
      if (tool?.slots?.includes("customer_records")) base.customer_records = toolId;
      return { ...p, base, anchor: toolId };
    });
  }

  return (
    <div className="space-y-6 pb-24">
      <Link href="/board" className="inline-flex min-h-11 items-center gap-1">
        <ArrowLeft aria-hidden className="size-4" />
        Back to my puzzle
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold sm:text-4xl">{block.plain_name}</h1>
        <p className="text-sm font-medium text-ink-2">{block.name}</p>
        <p className="max-w-2xl text-lg text-ink-2">{block.description}</p>
      </header>

      {block.sba_resource ? <SbaHint id={block.sba_resource} /> : null}

      {processorLocked ? (
        <Card className="state-base space-y-1">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <CheckCircle2 aria-hidden className="size-5 text-brand" />
            Handled by {anchor.name}
          </h2>
          <p className="text-ink-2">
            {anchor.name} takes card payments through its own system, so this piece is already filled.
          </p>
        </Card>
      ) : null}

      {results.included.length > 0 ? (
        <section aria-label="Already included">
          <Card className="space-y-3 border-brand">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <CheckCircle2 aria-hidden className="size-5 text-brand" />
              Check what you already have first
            </h2>
            <ul className="space-y-2">
              {results.included.map((i) => (
                <li key={i.feature} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{i.feature}</strong>
                    {i.addon_monthly_usd
                      ? `: a ${i.source} add-on, ${formatUsd(i.addon_monthly_usd)} a month.`
                      : `: already included in your ${i.source}.`}{" "}
                    {i.evidence_url ? (
                      <a href={i.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm">
                        Source
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                    ) : null}
                    {i.verified ? null : <span className="text-sm text-ink-2"> Unverified.</span>}
                  </span>
                  {i.toolId ? (
                    <Button
                      size="sm"
                      variant={current === i.toolId ? "secondary" : "primary"}
                      onClick={() => setPiece(block.id, current === i.toolId ? null : (i.toolId as string))}
                    >
                      {current === i.toolId ? "Remove from my puzzle" : "Use this"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <fieldset className="no-print space-y-2">
        <legend className="font-semibold">Show only</legend>
        <div className="flex flex-wrap gap-x-5">
          {FILTERS.map((f) => (
            <label key={f.key} className="flex min-h-11 items-center gap-2" title={f.help}>
              <input
                type="checkbox"
                className="size-5"
                checked={Boolean(filters[f.key])}
                onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.checked }))}
              />
              {f.label}
            </label>
          ))}
        </div>
        {results.filteredCount > 0 ? (
          <p role="status" className="text-sm text-ink-2">
            {results.filteredCount} hidden by your filters.
          </p>
        ) : null}
      </fieldset>

      {filters.noTraining && results.fits.length + results.catches.length === 0 ? (
        <p role="status" className="rounded-lg border border-line bg-surface p-3">
          We haven&apos;t confirmed a no-training policy for any tool here yet. That doesn&apos;t mean
          they train on your data: it means we couldn&apos;t find it in writing. Ask the vendor before
          you sign up.
        </p>
      ) : null}

      {results.fits.length > 0 ? (
        <section className="space-y-3" aria-label="Tools that fit">
          <h2 className="text-2xl font-bold">These fit</h2>
          <ul className="grid gap-4 lg:grid-cols-2">{results.fits.map((m, i) => card(m, i < 2))}</ul>
        </section>
      ) : null}

      {results.catches.length > 0 ? (
        <section className="space-y-3" aria-label="Tools that fit with a catch">
          <h2 className="text-2xl font-bold">These fit, with a catch</h2>
          <ul className="grid gap-4 lg:grid-cols-2">
            {results.catches.map((m, i) => card(m, results.fits.length === 0 && i < 2))}
          </ul>
        </section>
      ) : null}

      {results.notAllowed.length > 0 ? (
        <section className="space-y-3" aria-label="Tools that aren't allowed">
          <h2 className="text-2xl font-bold">Not allowed for your business</h2>
          <ul className="grid gap-4 lg:grid-cols-2">{results.notAllowed.map((m) => card(m, false))}</ul>
        </section>
      ) : null}

      {results.noFit.length > 0 ? (
        <details className="space-y-3">
          <summary className="min-h-11 cursor-pointer text-xl font-bold">
            Doesn&apos;t fit ({results.noFit.length})
          </summary>
          <ul className="mt-3 grid gap-4 lg:grid-cols-2">{results.noFit.map((m) => card(m, false))}</ul>
        </details>
      ) : null}

      {baseChoices.length > 0 ? (
        <section className="space-y-3" aria-label="System options">
          <h2 className="text-2xl font-bold">
            {processorLocked ? "What about another processor?" : "Choose your main system"}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {baseChoices.map((m) => (
              <li key={m.tool.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold">{m.tool.name}</h3>
                    <StateBadge state={m.verdict.visible} />
                  </div>
                  <ReasonList reasons={m.verdict.reasons.filter((r) => r.rule !== "OK")} />
                  {!processorLocked && m.verdict.visible !== "no_fit" ? (
                    <Button size="sm" onClick={() => chooseBase(m.tool.id)}>
                      This is what I use
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nothingFits && !processorLocked && baseChoices.length === 0 ? (
        <EmptyState title="We don't recommend anything here yet">
          <p className="mb-2">
            No AI tool in our catalog fits this piece for your business right now. That&apos;s a fair
            answer: you don&apos;t have to fill every piece.
          </p>
          <SbaHint id="sbdc_locator" />
        </EmptyState>
      ) : null}

      {results.hiddenCount > 0 ? (
        <p className="text-sm text-ink-2">
          {results.hiddenCount} more {results.hiddenCount === 1 ? "tool works" : "tools work"} only
          inside systems you don&apos;t use, so we left {results.hiddenCount === 1 ? "it" : "them"} out.
        </p>
      ) : null}

      {compare.length > 0 ? (
        <div className="no-print fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <p className="font-medium">
            Comparing {compare.length} of {MAX_COMPARE}:{" "}
            {compare.map((id) => catalog.byId.get(id)?.name).join(", ")}
          </p>
          <ButtonLink href={`/compare?block=${block.id}&tools=${compare.join(",")}`}>
            Compare
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
