"use client";

import { Check, CircleDollarSign, Clock, ExternalLink, Plus, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Chip, cn, ExternalButton } from "@/components/ui";
import { ReasonList } from "@/modules/board/seam-dialog";
import { StateBadge } from "@/modules/board/state-badge";
import { FIT_WEIGHTS, type FitBreakdown } from "@/modules/fit-score/score";
import { callTask } from "@/modules/llm/client-api";
import { explainPayload } from "@/modules/llm/payloads";
import type { Match } from "@/modules/matcher/match";
import { formatUsd } from "@/modules/plan/cost";
import { catalog } from "@/modules/taxonomy/catalog";
import type { BusinessProfile, Tool, Verdict } from "@/modules/taxonomy/types";

const START_LABEL: Record<Tool["how_to_start"]["type"], string> = {
  marketplace_install: "Install it",
  signup: "Sign up with the vendor",
  book_demo: "Ask the vendor for a demo",
};

const FACTORS: { key: keyof typeof FIT_WEIGHTS; label: string }[] = [
  { key: "integration", label: "Connects to your systems" },
  { key: "setup", label: "Easy to set up" },
  { key: "cost", label: "Cost against budget" },
  { key: "industry", label: "Made for your industry" },
  { key: "trust", label: "Evidence and privacy" },
];

export function FitBar({ fit }: { fit: FitBreakdown }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="font-semibold">Fit score: {fit.total} out of 100</p>
      <div
        className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`Fit score ${fit.total} out of 100`}
      >
        {FACTORS.map(({ key }, i) => (
          <span
            key={key}
            style={{
              width: `${fit[key] * FIT_WEIGHTS[key]}%`,
              background: "var(--brand)",
              opacity: 1 - i * 0.14,
            }}
          />
        ))}
      </div>
      <details className="mt-1">
        <summary className="min-h-8 cursor-pointer py-1 text-sm">How we scored this</summary>
        <dl className="mt-1 grid gap-1 text-sm">
          {FACTORS.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-ink-2">
                {label} ({Math.round(FIT_WEIGHTS[key] * 100)}%)
              </dt>
              <dd className="font-semibold">{fit[key]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

/** Deterministic fallback for explain_verdict. */
export function explainTemplate(tool: Tool, verdict: Verdict): string {
  const main =
    verdict.reasons.find((r) => r.rule !== "OK" && r.rule !== "NOTE") ?? verdict.reasons[0];
  return main?.message ?? `${tool.name} has no known conflicts with what you run.`;
}

function useExplanation(
  tool: Tool,
  verdict: Verdict,
  profile: BusinessProfile,
  enabled: boolean,
): string {
  const template = explainTemplate(tool, verdict);
  const key = `${tool.id}|${verdict.state}|${template}`;
  const [ai, setAi] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void callTask<{ sentence: string }>(
      "explain_verdict",
      explainPayload(tool, verdict, profile),
    ).then((r) => {
      if (live && r?.sentence) setAi({ key, text: r.sentence });
    });
    return () => {
      live = false;
    };
    // The key captures everything the explanation depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return ai?.key === key ? ai.text : template;
}

function PriceBlock({ match, profile }: { match: Match; profile: BusinessProfile }) {
  const { cost, tool, fit } = match;
  const budget = profile.monthly_budget_usd ?? 200;
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-2">
        <CircleDollarSign aria-hidden className="size-4 self-center text-ink-2" />
        <span className="text-xl font-bold">{formatUsd(cost.monthly_usd)}</span>
        {cost.monthly_usd !== null ? <span className="text-ink-2">a month</span> : null}
        {fit?.over_budget ? (
          <Chip className="state-catch font-semibold" style={{ color: "var(--state)", background: "var(--state-tint)", borderColor: "var(--state-line)" }}>
            <TriangleAlert aria-hidden className="size-3.5" />
            Over your ${budget} budget
          </Chip>
        ) : null}
      </p>
      <ul className="text-sm text-ink-2">
        {cost.lines.map((l) => (
          <li key={l.label}>
            {l.label}: {formatUsd(l.monthly_usd)}
            {l.note ? ` (${l.note})` : ""}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">
        {tool.free_tier ? "Has a free plan. " : ""}
        {tool.trial_days ? `${tool.trial_days}-day free trial. ` : ""}
        {tool.contract_term ? `Contract: ${tool.contract_term}.` : ""}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ToolCard({
  match,
  profile,
  chosen,
  comparing,
  onToggle,
  onCompare,
  explain,
}: {
  match: Match;
  profile: BusinessProfile;
  chosen: boolean;
  comparing: boolean;
  onToggle: () => void;
  onCompare: () => void;
  explain: boolean;
}) {
  const { tool, verdict, fit } = match;
  const sentence = useExplanation(tool, verdict, profile, explain);
  const canAdd = verdict.visible === "fits" || verdict.visible === "catch";
  const details = verdict.reasons.filter((r) => r.message !== sentence || r.evidence_url);

  return (
    <Card className={cn("space-y-4", `state-${verdict.visible}`)} style={{ borderColor: "var(--state-line)" }}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-xl font-bold">{tool.name}</h3>
          <StateBadge state={verdict.visible} />
        </div>
        <p className="text-lg">{sentence}</p>
        <div className="flex flex-wrap gap-1.5">
          {verdict.badges.includes("hard_to_swap") ? <Chip>Hard to swap later</Chip> : null}
          {verdict.badges.includes("unverified") ? (
            <Chip title="We couldn't confirm every fact here on a source page.">Unverified</Chip>
          ) : null}
        </div>
      </div>

      {tool.ai_capabilities.length > 0 ? (
        <div>
          <h4 className="flex items-center gap-1.5 font-semibold">
            <Sparkles aria-hidden className="size-4 text-brand" />
            What the AI does
          </h4>
          <ul className="ml-5 list-disc text-ink-2">
            {tool.ai_capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PriceBlock match={match} profile={profile} />

      <p className="flex items-center gap-1.5 text-sm text-ink-2">
        <Clock aria-hidden className="size-4" />
        About {tool.setup.hours_estimate} {tool.setup.hours_estimate === 1 ? "hour" : "hours"} to set up (our estimate)
        {tool.setup.no_code ? ", no coding" : ""}
      </p>

      {verdict.alternatives && verdict.alternatives.length > 0 ? (
        <p>
          <strong>These fit instead:</strong>{" "}
          {verdict.alternatives.map((id) => catalog.byId.get(id)?.name).join(", ")}
        </p>
      ) : null}

      {fit ? <FitBar fit={fit} /> : null}

      {details.length > 0 ? (
        <details>
          <summary className="min-h-8 cursor-pointer font-semibold">Why we say this</summary>
          <div className="mt-2">
            <ReasonList reasons={verdict.reasons} />
          </div>
        </details>
      ) : null}

      <details>
        <summary className="min-h-8 cursor-pointer font-semibold">Sources</summary>
        <ul className="mt-2 space-y-2 text-sm">
          {tool.evidence.map((e) => (
            <li key={e.claim}>
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                {e.claim}
                <ExternalLink aria-hidden className="size-3 shrink-0" />
              </a>
              {e.quote ? <span className="block text-ink-2">&ldquo;{e.quote}&rdquo;</span> : null}
            </li>
          ))}
          <li className="text-ink-2">
            {tool.verified ? `Verified ${formatDate(tool.last_checked)}` : `Unverified. Last looked at ${formatDate(tool.last_checked)}`}
          </li>
          {tool.caution ? <li className="font-medium">{tool.caution}</li> : null}
        </ul>
      </details>

      <div className="no-print flex flex-wrap gap-2">
        {canAdd ? (
          <Button onClick={onToggle} variant={chosen ? "secondary" : "primary"}>
            {chosen ? <X aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
            {chosen ? "Remove from my puzzle" : "Add to my puzzle"}
          </Button>
        ) : null}
        <ExternalButton href={tool.how_to_start.url} variant="secondary">
          {START_LABEL[tool.how_to_start.type]}
          <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(opens the vendor&apos;s site in a new tab)</span>
        </ExternalButton>
        <Button onClick={onCompare} variant="ghost" aria-pressed={comparing}>
          {comparing ? <Check aria-hidden className="size-4" /> : null}
          {comparing ? "Comparing" : "Compare"}
        </Button>
      </div>
    </Card>
  );
}
