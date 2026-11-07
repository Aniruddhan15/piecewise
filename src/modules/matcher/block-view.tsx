"use client";

import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Reveal } from "@/components/reveal";
import { Button, ButtonLink, Card, cn, EmptyState } from "@/components/ui";
import { chosenTools, useStore } from "@/modules/board/store";
import { ReasonList } from "@/modules/board/seam-dialog";
import { StateBadge } from "@/modules/board/state-badge";
import { resolveAnchor } from "@/modules/compat-engine/engine";
import { SbaHint } from "@/modules/sba/sba-panel";
import { catalog } from "@/modules/taxonomy/catalog";
import type { AccountingEdition } from "@/modules/taxonomy/types";
import { OptionCard } from "@/modules/tool-start/option-card";
import { formatUsd } from "@/modules/plan/cost";
import { matchBlock, type Filters } from "./match";

const FILTERS: { key: keyof Filters; label: string; help?: string }[] = [
  { key: "startFree", label: "Start free" },
  { key: "underBudget", label: "Under budget" },
  { key: "noCode", label: "No coding" },
  { key: "noTraining", label: "Doesn't train AI on my data", help: "Only shows tools whose policy we confirmed." },
];

export function BlockView({ blockId }: { blockId: string }) {
  const { state, setPiece, setProfile } = useStore();
  const { profile, pieces } = state;
  const [filters, setFilters] = useState<Filters>({});
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
        <ButtonLink href="/matches" variant="secondary">
          Back to my picks
        </ButtonLink>
      </EmptyState>
    );
  }

  const current = pieces[block.id];
  const options = [...results.fits, ...results.catches];
  const notForYou = [...results.notAllowed, ...results.noFit];

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
    <div className="space-y-8 pb-16">
      <Link href="/matches" className="inline-flex min-h-11 items-center gap-1 font-semibold">
        <ArrowLeft aria-hidden className="size-4" />
        Back to my picks
      </Link>
      <header className="mx-auto max-w-2xl space-y-3 text-center">
        <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">{block.name}</p>
        <h1 className="text-4xl font-extrabold sm:text-5xl">{block.plain_name}</h1>
        <p className="text-lg text-ink-2">
          {options.length > 0
            ? `${options.length} ${options.length === 1 ? "tool works" : "tools work"} for you${anchor ? ` with ${anchor.name}` : ""}. Pick one to see how to start.`
            : block.description}
        </p>
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
                    {i.verified ? null : <span className="text-sm text-ink-2"> Not double-checked yet.</span>}
                  </span>
                  {i.toolId ? (
                    <Button
                      size="sm"
                      variant={current === i.toolId ? "secondary" : "primary"}
                      onClick={() => setPiece(block.id, current === i.toolId ? null : (i.toolId as string))}
                    >
                      {current === i.toolId ? "Remove from my kit" : "Use this"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <fieldset className="no-print flex flex-wrap items-center justify-center gap-2">
        <legend className="sr-only">Show only</legend>
        <span aria-hidden className="text-sm font-semibold text-ink-2">
          Show only:
        </span>
        {FILTERS.map((f) => (
          <label
            key={f.key}
            title={f.help}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              filters[f.key] ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:border-ink-3",
            )}
          >
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={Boolean(filters[f.key])}
              onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.checked }))}
            />
            {f.label}
          </label>
        ))}
        {results.filteredCount > 0 ? (
          <p role="status" className="w-full text-center text-sm text-ink-2">
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

      {options.length > 0 ? (
        <section aria-label="Tools that work for you">
          <ul
            className={cn(
              "grid gap-x-4 gap-y-2",
              options.length === 1 ? "mx-auto max-w-sm" : options.length === 2 ? "mx-auto max-w-3xl sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
              options.length >= 4 && "xl:grid-cols-4",
            )}
          >
            {options.map((m, i) => (
              <OptionCard
                key={m.tool.id}
                match={m}
                blockId={block.id}
                anchorName={anchor?.name}
                best={i === 0 && options.length > 1}
                inKit={current === m.tool.id}
                index={i}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {notForYou.length > 0 ? (
        <Reveal>
          <details className="rounded-2xl border border-line bg-surface p-4">
            <summary className="min-h-11 cursor-pointer font-bold">
              Not a fit for you ({notForYou.length})
            </summary>
            <ul className="mt-2 divide-y divide-line">
              {notForYou.map((m) => (
                <li key={m.tool.id} className="space-y-1 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.tool.name}
                    <StateBadge state={m.verdict.visible} />
                  </p>
                  <p className="text-ink-2">
                    {m.verdict.reasons.find((r) => r.rule !== "OK" && r.rule !== "NOTE")?.message ?? m.verdict.reasons[0]?.message}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </Reveal>
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

      {options.length >= 2 ? (
        <p className="text-center">
          <Link
            href={`/compare?block=${block.id}&tools=${options.slice(0, 3).map((m) => m.tool.id).join(",")}`}
            className="inline-flex min-h-11 items-center font-semibold"
          >
            Compare the top {Math.min(3, options.length)} side by side
          </Link>
        </p>
      ) : null}
    </div>
  );
}
