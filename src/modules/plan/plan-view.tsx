"use client";

import { Check, Copy, ExternalLink, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink, Card, EmptyState, ExternalButton, PageTitle } from "@/components/ui";
import { encodeState, useStore } from "@/modules/board/store";
import { PieceShape } from "@/modules/board/piece-shape";
import { ReasonList } from "@/modules/board/seam-dialog";
import { STATE_INFO, StateBadge } from "@/modules/board/state-badge";
import { baseSystems, resolveAnchor } from "@/modules/compat-engine/engine";
import { callTask } from "@/modules/llm/client-api";
import { personalizePayload } from "@/modules/llm/payloads";
import { SbaPanel } from "@/modules/sba/sba-panel";
import { catalog } from "@/modules/taxonomy/catalog";
import type { Tool } from "@/modules/taxonomy/types";
import { buildPlan } from "./build-plan";
import { formatUsd } from "./cost";

const CHECK_KEY = "piecewise:checks:v1";

function readChecks(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(CHECK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function usePersonalizedSteps(tool: Tool, description: string): string[] {
  const [steps, setSteps] = useState<string[]>(tool.setup.steps);
  useEffect(() => {
    let live = true;
    void callTask<{ steps: string[] }>(
      "personalize_steps",
      personalizePayload(tool, description),
    ).then((r) => {
      // Same number of steps, or it isn't a rewording.
      if (live && r?.steps?.length === tool.setup.steps.length) setSteps(r.steps);
    });
    return () => {
      live = false;
    };
  }, [tool, description]);
  return steps;
}

function SetupChecklist({
  tool,
  description,
  checks,
  onCheck,
}: {
  tool: Tool;
  description: string;
  checks: Record<string, boolean>;
  onCheck: (key: string, value: boolean) => void;
}) {
  const steps = usePersonalizedSteps(tool, description);
  return (
    <article className="space-y-2">
      <h3 className="text-lg font-bold">{tool.name}</h3>
      <ul className="space-y-1">
        {steps.map((step, i) => {
          const key = `${tool.id}:${i}`;
          return (
            <li key={key}>
              <label className="flex min-h-11 items-start gap-2 py-1">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0"
                  checked={Boolean(checks[key])}
                  onChange={(e) => onCheck(key, e.target.checked)}
                />
                <span>{step}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {tool.setup.data_needed.length > 0 ? (
        <p className="text-sm text-ink-2">
          <strong>Data you&apos;ll need:</strong> {tool.setup.data_needed.join("; ")}
        </p>
      ) : null}
      <ExternalButton
        href={tool.how_to_start.url}
        variant="secondary"
        size="sm"
        className="no-print"
      >
        Go to {tool.name}
        <ExternalLink aria-hidden className="size-4" />
      </ExternalButton>
    </article>
  );
}

export function PlanView() {
  const { state } = useStore();
  const { profile, pieces } = state;
  const plan = useMemo(() => buildPlan(profile, pieces, catalog), [profile, pieces]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const anchor = resolveAnchor(profile, catalog);
  const base = baseSystems(profile, catalog);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only saved checklist
    setChecks(readChecks());
  }, []);

  function setCheck(key: string, value: boolean) {
    setChecks((c) => {
      const next = { ...c, [key]: value };
      try {
        window.localStorage.setItem(CHECK_KEY, JSON.stringify(next));
      } catch {
        // Checkmarks stay for this visit only.
      }
      return next;
    });
  }

  async function copyLink() {
    const url = `${window.location.origin}/plan?s=${encodeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  if (plan.tools.length === 0) {
    return (
      <EmptyState title="Your plan starts with one piece">
        <p className="mb-4">Add a tool to any piece of your puzzle and it will show up here.</p>
        <ButtonLink href="/board">Back to my puzzle</ButtonLink>
      </EmptyState>
    );
  }

  const urgent = plan.anyNotAllowed
    ? "One of your pieces isn't allowed. An advisor can help you find a compliant option."
    : plan.overBudget
      ? "This plan is over your budget. An advisor can help you decide what to do first."
      : undefined;

  const hours = plan.rollout.reduce((sum, s) => sum + s.hours, 0);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Your adoption plan"
        intro={`${profile.description || "Your business"}${anchor ? `, built around ${anchor.name}` : ""}.`}
      />

      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={() => void copyLink()} variant="secondary">
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copied ? "Link copied" : "Copy a link to this plan"}
        </Button>
        <Button onClick={() => window.print()} variant="secondary">
          <Printer aria-hidden className="size-4" />
          Print or save as PDF
        </Button>
        <ButtonLink href="/board" variant="ghost">
          Change my puzzle
        </ButtonLink>
      </div>

      <section aria-labelledby="stack">
        <Card className="space-y-4">
          <h2 id="stack" className="text-2xl font-bold">
            Your stack
          </h2>
          <ul
            aria-hidden
            className="grid grid-cols-3 pr-[3%] pb-[3%] sm:grid-cols-5 lg:grid-cols-7"
          >
            {[
              ...base.map((t) => ({ id: t.id, name: t.name, state: "base" as const })),
              ...plan.tools.map((t) => ({
                id: t.tool.id,
                name: t.tool.name,
                state: t.verdict.visible,
              })),
            ].map((p) => (
              <li
                key={p.id}
                className={`state-${p.state} relative flex min-h-20 items-center justify-center p-3 text-center text-xs font-semibold`}
              >
                <PieceShape mismatch={p.state === "no_fit"} heavy={p.state === "not_allowed"} />
                <span className="relative">{p.name}</span>
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-line">
            {base.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{t.name}</strong>
                  <span className="text-ink-2">
                    {" "}
                    ({t.id === anchor?.id ? "your main system" : "already in place"})
                  </span>
                  {t.contract_term ? (
                    <span className="block text-sm text-ink-2">
                      Hard to swap later: {t.contract_term}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
            {plan.tools.map((t) => (
              <li
                key={t.blockId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <strong>{t.tool.name}</strong>
                  <span className="text-ink-2"> · {t.blockName}</span>
                </span>
                <StateBadge state={t.verdict.visible} />
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="cost">
        <Card className="space-y-3">
          <h2 id="cost" className="text-2xl font-bold">
            What it costs each month
          </h2>
          <table className="w-full text-left">
            <thead className="sr-only">
              <tr>
                <th>Item</th>
                <th>Monthly cost</th>
              </tr>
            </thead>
            <tbody>
              {plan.costLines.map((l) => (
                <tr key={l.label} className="border-b border-line">
                  <td className="py-2 pr-3">
                    {l.label}
                    {l.note ? <span className="text-sm text-ink-2"> ({l.note})</span> : null}
                  </td>
                  <td className="py-2 text-right font-semibold">{formatUsd(l.monthly_usd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="py-2 pr-3 text-lg">
                  New monthly cost
                </th>
                <td className="py-2 text-right text-xl font-bold">
                  {formatUsd(plan.total)}
                  {plan.hasUnknownPrice ? " +" : ""}
                </td>
              </tr>
            </tfoot>
          </table>
          <p
            className={plan.overBudget ? "state-catch font-semibold" : "text-ink-2"}
            style={plan.overBudget ? { color: "var(--state)" } : undefined}
          >
            {plan.overBudget
              ? `That's ${formatUsd(plan.total - plan.budget)} over your ${formatUsd(plan.budget)} budget.`
              : `That's within your ${formatUsd(plan.budget)} budget.`}
            {plan.hasUnknownPrice
              ? " Some vendors don't publish a price, so the real total is higher."
              : ""}
          </p>
          <p className="text-sm text-ink-2">
            You pay vendors directly. PieceWise never charges you or takes a cut. Systems you
            already run aren&apos;t counted here, and neither are tools that don&apos;t fit or
            aren&apos;t allowed. Usage fees (per call or per message) can add to this.
          </p>
        </Card>
      </section>

      <section aria-labelledby="order">
        <Card className="space-y-3">
          <h2 id="order" className="text-2xl font-bold">
            What to do, in order
          </h2>
          <p className="text-ink-2">About {hours} hours in total (our estimate).</p>
          <ol className="space-y-3">
            {plan.rollout.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-ink"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">
                    {step.title}{" "}
                    <span className="font-normal text-ink-2">
                      (about {step.hours} {step.hours === 1 ? "hour" : "hours"})
                    </span>
                  </p>
                  <p className="text-ink-2">{step.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {plan.issues.length > 0 ? (
        <section aria-labelledby="issues">
          <Card className="space-y-4">
            <h2 id="issues" className="text-2xl font-bold">
              Things to watch ({plan.issues.length})
            </h2>
            <ul className="space-y-4">
              {plan.issues.map((issue) => (
                <li
                  key={`${issue.title}-${issue.reason.rule}-${issue.reason.message}`}
                  className={`state-${issue.state} space-y-1 border-l-4 pl-3`}
                  style={{ borderColor: "var(--state-line)" }}
                >
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {issue.title}
                    <span className="sr-only">: {STATE_INFO[issue.state].label}</span>
                  </p>
                  <ReasonList reasons={[issue.reason]} />
                  <p>
                    <strong>What to do:</strong> {issue.todo}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {plan.usable.length > 0 ? (
        <section aria-labelledby="setup">
          <Card className="space-y-5">
            <h2 id="setup" className="text-2xl font-bold">
              Setup checklists
            </h2>
            <p className="text-ink-2">Your checkmarks are saved in this browser.</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {plan.usable.map((t) => (
                <SetupChecklist
                  key={t.tool.id}
                  tool={t.tool}
                  description={profile.description}
                  checks={checks}
                  onCheck={setCheck}
                />
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section aria-label="Free help">
        <SbaPanel urgent={urgent} />
      </section>
    </div>
  );
}
