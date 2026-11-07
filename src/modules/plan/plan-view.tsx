"use client";

import { Check, ExternalLink, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Reveal } from "@/components/reveal";
import { Button, ButtonLink, Card, EmptyState, ExternalButton } from "@/components/ui";
import { encodeState, useStore } from "@/modules/board/store";
import { useAuth } from "@/modules/auth/auth-provider";
import { ARCHETYPE_ICON } from "@/modules/finder/icons";
import { HexShape, shapeFromKit } from "@/modules/kit/hex-kit";
import { kitState } from "@/modules/kit/kit";
import { ReasonList } from "@/modules/board/seam-dialog";
import { STATE_INFO, StateBadge } from "@/modules/board/state-badge";
import { baseSystems, resolveAnchor } from "@/modules/compat-engine/engine";
import { SbaPanel } from "@/modules/sba/sba-panel";
import { usePersonalizedSteps } from "@/modules/tool-start/use-steps";
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

/** Offers an account only once there's something worth keeping. */
function SaveNudge() {
  const { enabled, ready, user } = useAuth();
  if (!enabled || !ready) return null;
  if (user) {
    return <p className="no-print text-sm font-semibold text-brand">Saved to your account. Open it from any device.</p>;
  }
  return (
    <p className="no-print text-sm text-ink-2">
      Want it on your phone too?{" "}
      <Link href="/signup?next=/plan" className="font-semibold">
        Save it to a free account
      </Link>
    </p>
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
  const kit = useMemo(
    () =>
      kitState(
        { profile, pieces, pains: state.suggested ?? [], skipped: state.skipped ?? [] },
        catalog,
      ),
    [profile, pieces, state.suggested, state.skipped],
  );

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

  async function share() {
    const url = `${window.location.origin}/plan?s=${encodeState(state)}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "My AI tool plan", url });
        return;
      } catch {
        // Cancelled: fall back to copying.
      }
    }
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
      <EmptyState title="Your kit starts with one tool">
        <p className="mb-4">Add a tool from your picks and your plan shows up here.</p>
        <ButtonLink href="/matches">Back to my picks</ButtonLink>
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
      <section className="grid items-center gap-6 rounded-3xl border border-line bg-surface p-5 sm:p-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
            {profile.description || "Your business"}
            {anchor ? ` · on ${anchor.name}` : ""}
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            {kit.complete ? "Your kit is complete" : "Your kit"}
          </h1>
          <p className="max-w-xl text-lg text-ink-2">
            {plan.usable.length} new {plan.usable.length === 1 ? "tool" : "tools"}, about{" "}
            {formatUsd(plan.total)}
            {plan.hasUnknownPrice ? "+" : ""} a month, and about {hours} {hours === 1 ? "hour" : "hours"} to set up.
            {kit.complete ? "" : ` ${kit.wedges.length - kit.covered} more ${kit.wedges.length - kit.covered === 1 ? "job" : "jobs"} to cover.`}
          </p>
          <ul className="space-y-1.5">
            {base.map((t) => (
              <li key={t.id} className="text-ink-2">
                <strong className="text-ink">{t.name}</strong>{" "}
                {t.id === anchor?.id ? "runs the center of your kit" : "is already in place"}
                {t.contract_term ? `. Hard to swap later: ${t.contract_term}` : ""}
              </li>
            ))}
            {plan.tools.map((t) => (
              <li key={t.blockId} className="flex flex-wrap items-center gap-2">
                <strong>{t.tool.name}</strong>
                <span className="text-ink-2">for {t.blockName.toLowerCase()}</span>
                <StateBadge state={t.verdict.visible} />
              </li>
            ))}
          </ul>
          <div className="no-print flex flex-wrap gap-2 pt-2">
            <Button onClick={() => void share()}>
              {copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
              {copied ? "Link copied" : "Send this plan"}
            </Button>
            <Button onClick={() => window.print()} variant="secondary">
              <Printer aria-hidden className="size-4" />
              Print or save as PDF
            </Button>
            <ButtonLink href="/matches" variant="ghost">
              Change my kit
            </ButtonLink>
          </div>
          <p className="no-print text-sm text-ink-2">
            Send it to whoever helps with your tech, or to yourself. The link holds the whole plan.
          </p>
          <SaveNudge />
        </div>
        <HexShape
          wedges={shapeFromKit(kit)}
          hubTitle={anchor?.name ?? catalog.archetypeById.get(profile.archetypes[0])?.examples[0] ?? "You"}
          hubIcon={ARCHETYPE_ICON[profile.archetypes[0]]}
          complete={kit.complete}
          className="mx-auto max-w-[22rem]"
        />
      </section>

      <Reveal as="section" aria-labelledby="cost">
        <Card className="space-y-3">
          <h2 id="cost" className="text-2xl font-extrabold">
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
      </Reveal>

      <Reveal as="section" aria-labelledby="order">
        <Card className="space-y-3">
          <h2 id="order" className="text-2xl font-extrabold">
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
      </Reveal>

      {plan.issues.length > 0 ? (
        <Reveal as="section" aria-labelledby="issues">
          <Card className="space-y-4">
            <h2 id="issues" className="text-2xl font-extrabold">
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
        </Reveal>
      ) : null}

      {plan.usable.length > 0 ? (
        <Reveal as="section" aria-labelledby="setup">
          <Card className="space-y-5">
            <h2 id="setup" className="text-2xl font-extrabold">
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
        </Reveal>
      ) : null}

      <Reveal as="section" aria-label="Free help">
        <SbaPanel urgent={urgent} />
      </Reveal>
    </div>
  );
}
