"use client";

import { ArrowLeft, ArrowRight, Check, Clock, ExternalLink, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import { Button, ButtonLink, cn, EmptyState, ExternalButton } from "@/components/ui";
import { chosenTools, useStore } from "@/modules/board/store";
import { ReasonList } from "@/modules/board/seam-dialog";
import { resolveAnchor } from "@/modules/compat-engine/engine";
import { blocksForProfile, matchTool } from "@/modules/matcher/match";
import { catalog } from "@/modules/taxonomy/catalog";
import { accountSteps, summarize, vendorName } from "./summary";
import { usePersonalizedSteps } from "./use-steps";

const START_BUTTON = {
  signup: "Create my account",
  book_demo: "Book a demo",
  marketplace_install: "Install it",
} as const;

function StepCard({
  number,
  title,
  intro,
  children,
  delay,
}: {
  number: number;
  title: string;
  intro: string;
  children: ReactNode;
  delay: number;
}) {
  return (
    <Reveal as="section" delay={delay} aria-labelledby={`step-${number}`} className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-xl font-extrabold text-bg">
          {number}
        </span>
        <div className="space-y-1">
          <h2 id={`step-${number}`} className="text-2xl font-extrabold">
            {title}
          </h2>
          <p className="text-ink-2">{intro}</p>
        </div>
      </div>
      {children}
    </Reveal>
  );
}

export function ToolStartView({ toolId, blockId }: { toolId: string; blockId?: string }) {
  const { state, setPiece } = useStore();
  const { profile, pieces } = state;
  const tool = catalog.byId.get(toolId);
  const anchor = resolveAnchor(profile, catalog);

  // The job this tool is for: the one we came from, else the first one this business has.
  const block = useMemo(() => {
    if (!tool) return undefined;
    const mine = new Set(blocksForProfile(profile, catalog).map((b) => b.id));
    const id = (blockId && tool.blocks.includes(blockId) ? blockId : undefined) ?? tool.blocks.find((b) => mine.has(b)) ?? tool.blocks[0];
    return catalog.blockById.get(id);
  }, [tool, blockId, profile]);

  const match = useMemo(() => {
    if (!tool) return undefined;
    const others = chosenTools(pieces).filter((t) => t.id !== tool.id);
    return matchTool(tool, profile, others, catalog);
  }, [tool, profile, pieces]);

  const steps = usePersonalizedSteps(tool ?? catalog.tools[0], profile.description);

  if (!tool || !match || !block) {
    return (
      <EmptyState title="We couldn't find that tool">
        <ButtonLink href="/matches" variant="secondary">
          Back to my picks
        </ButtonLink>
      </EmptyState>
    );
  }

  const s = summarize(match, anchor?.name);
  const inKit = pieces[block.id] === tool.id;
  const canAdd = match.verdict.visible === "fits" || match.verdict.visible === "catch";
  const catchReason =
    match.verdict.visible === "catch"
      ? match.verdict.reasons.find((r) => r.rule !== "OK" && r.rule !== "NOTE")?.message
      : undefined;
  const blocked = match.verdict.visible === "no_fit" || match.verdict.visible === "not_allowed";
  const vendor = vendorName(tool);

  return (
    <div className="space-y-8 pb-10">
      <Link href={`/block/${block.id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold">
        <ArrowLeft aria-hidden className="size-4" />
        All options to {block.plain_name.toLowerCase()}
      </Link>

      <Reveal as="header" className="grid gap-6 rounded-3xl p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end" style={{ background: "var(--best-bg)" }}>
        <div className="space-y-3">
          <p className="text-sm font-bold tracking-wide text-white/75 uppercase">{block.plain_name}</p>
          <h1 className="text-4xl font-extrabold sm:text-6xl">{tool.name}</h1>
          <p className="max-w-2xl text-lg text-white/90">{s.oneLiner}</p>
          <p className="flex items-center gap-1.5 font-bold">
            {s.fitKind === "catch" ? <TriangleAlert aria-hidden className="size-4" /> : s.fitKind === "fits" ? <Check aria-hidden className="size-4" /> : null}
            {blocked ? "Not a fit for your setup" : s.fitLine}
          </p>
        </div>
        <div className="space-y-3 lg:text-right">
          <div>
            <p className="font-display text-4xl font-extrabold">{s.price}</p>
            <p className="text-white/80">{s.priceNote}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2 lg:justify-end">
            {canAdd ? (
              <button
                type="button"
                aria-pressed={inKit}
                onClick={() => setPiece(block.id, inKit ? null : tool.id)}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-semibold transition-transform hover:scale-[1.02]",
                  inKit ? "bg-white/15 text-white ring-2 ring-white/60" : "bg-honey text-[#10241d]",
                )}
              >
                {inKit ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
                {inKit ? "In my kit" : "Add to my kit"}
              </button>
            ) : null}
            <a
              href={tool.vendor_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-semibold text-[#10241d] no-underline transition-transform hover:scale-[1.02]"
            >
              Visit {vendor}
              <ExternalLink aria-hidden className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </Reveal>

      {catchReason ? (
        <Reveal className="flex gap-3 rounded-2xl border-2 border-honey bg-honey-tint p-4">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong>The catch:</strong> {catchReason}
          </p>
        </Reveal>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <StepCard number={1} title="Create your account" intro={`On ${vendor}. It takes a few minutes.`} delay={0}>
          <ol className="space-y-3">
            {accountSteps(tool, { anchorName: anchor?.name, tier: match.cost.tier, jobName: block.plain_name }).map((step, i) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <ExternalButton href={tool.how_to_start.url} className="mt-auto w-full" size="lg">
            {START_BUTTON[tool.how_to_start.type]} at {vendor}
            <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </ExternalButton>
        </StepCard>

        <StepCard
          number={2}
          title="Set it up and use it"
          intro={`About ${tool.setup.hours_estimate} ${tool.setup.hours_estimate === 1 ? "hour" : "hours"}${tool.setup.no_code ? ", no coding needed" : ""}.`}
          delay={120}
        >
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={`${i}-${step}`} className="flex gap-3">
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {tool.setup.data_needed.length > 0 ? (
            <p className="mt-auto flex gap-2 rounded-2xl bg-surface-2 p-3 text-ink-2">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong className="text-ink">Have this ready:</strong> {tool.setup.data_needed.join("; ")}
              </span>
            </p>
          ) : null}
        </StepCard>
      </div>

      <Reveal>
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-11 cursor-pointer font-bold">Why we say it {blocked ? "doesn't fit" : "fits"} your setup</summary>
          <div className="mt-3 space-y-4">
            <ReasonList reasons={match.verdict.reasons} />
            {tool.ai_capabilities.length > 0 ? (
              <div>
                <p className="font-semibold">What the AI does</p>
                <ul className="ml-5 list-disc text-ink-2">
                  {tool.ai_capabilities.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </Reveal>

      <div className="no-print flex flex-wrap items-center justify-center gap-2">
        {canAdd && !inKit ? (
          <Button size="lg" onClick={() => setPiece(block.id, tool.id)}>
            <Plus aria-hidden className="size-5" />
            Add {tool.name} to my kit
          </Button>
        ) : null}
        <ButtonLink href="/matches" size="lg" variant={inKit ? "primary" : "secondary"}>
          Next job
          <ArrowRight aria-hidden className="size-5" />
        </ButtonLink>
      </div>
    </div>
  );
}
