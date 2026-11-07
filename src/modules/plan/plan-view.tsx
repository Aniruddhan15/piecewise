"use client";

import { ArrowRight, Check, CloudCheck, Printer, Save, Share2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Reveal } from "@/components/reveal";
import { Button, ButtonLink, Card, EmptyState } from "@/components/ui";
import { useAuth } from "@/modules/auth/auth-provider";
import { ReasonList } from "@/modules/board/seam-dialog";
import { STATE_INFO, StateBadge } from "@/modules/board/state-badge";
import { encodeState, useStore } from "@/modules/board/store";
import { ARCHETYPE_ICON } from "@/modules/finder/icons";
import { HexShape, shapeFromKit } from "@/modules/kit/hex-kit";
import { SbaPanel } from "@/modules/sba/sba-panel";
import { usePlanData } from "@/modules/setup/use-plan";
import { catalog } from "@/modules/taxonomy/catalog";
import { formatUsd } from "./cost";

/**
 * The plan (M11): a summary to read, share and save. Setting things up happens on its own
 * page, one tool at a time, and saving leads to the dashboard, so the journey has an end.
 */
export function PlanView() {
  const router = useRouter();
  const auth = useAuth();
  const { savePlan } = useStore();
  const { state, profile, plan, kit, sequence, hours, anchor, base } = usePlanData();
  const [copied, setCopied] = useState(false);

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

  function save(toAccount: boolean) {
    savePlan();
    router.push(toAccount ? "/signup?next=/dashboard" : "/dashboard");
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
  const signedIn = Boolean(auth.user);

  return (
    <div className="space-y-6">
      <section className="grid items-center gap-6 rounded-3xl border border-line bg-surface p-5 sm:p-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">
            Your plan · {profile.description || "Your business"}
            {anchor ? ` · on ${anchor.name}` : ""}
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{kit.complete ? "Your kit is complete" : "Your plan"}</h1>
          <p className="max-w-xl text-lg text-ink-2">
            {sequence.length} new {sequence.length === 1 ? "tool" : "tools"}, about {formatUsd(plan.total)}
            {plan.hasUnknownPrice ? "+" : ""} a month, and about {hours} {hours === 1 ? "hour" : "hours"} to set up.
          </p>
          <ul className="space-y-1.5">
            {base.map((t) => (
              <li key={t.id} className="text-ink-2">
                <strong className="text-ink">{t.name}</strong>{" "}
                {t.id === anchor?.id ? "runs the center of your kit" : "is already in place"}
                {t.contract_term ? `. Hard to swap later: ${t.contract_term}` : ""}
              </li>
            ))}
            {sequence.map((t) => {
              const entry = plan.usable.find((u) => u.tool.id === t.tool.id);
              return (
                <li key={t.tool.id} className="flex flex-wrap items-center gap-2">
                  <strong>{t.tool.name}</strong>
                  <span className="text-ink-2">for {t.jobs.map((j) => j.toLowerCase()).join(" and ")}</span>
                  {entry ? <StateBadge state={entry.verdict.visible} /> : null}
                </li>
              );
            })}
          </ul>
          <div className="no-print flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={() => void share()}>
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
        </div>
        <HexShape
          wedges={shapeFromKit(kit)}
          hubTitle={anchor?.name ?? catalog.archetypeById.get(profile.archetypes[0])?.examples[0] ?? "You"}
          hubIcon={ARCHETYPE_ICON[profile.archetypes[0]]}
          complete={kit.complete}
          className="mx-auto max-w-[22rem]"
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
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
              {plan.hasUnknownPrice ? " Some vendors don't publish a price, so the real total is higher." : ""}
            </p>
            <p className="text-sm text-ink-2">You pay vendors directly. PieceWise never charges you or takes a cut.</p>
          </Card>
        </Reveal>

        <Reveal as="section" aria-labelledby="next" delay={100}>
          <Card className="space-y-4">
            <h2 id="next" className="text-2xl font-extrabold">
              What&apos;s next
            </h2>
            <p className="text-ink-2">
              Set up your tools one at a time: create the account, then follow the steps. About {hours}{" "}
              {hours === 1 ? "hour" : "hours"} in total.
            </p>
            <ol className="space-y-2">
              {sequence.map((t, i) => (
                <li key={t.tool.id} className="flex items-center gap-3">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">
                    {i + 1}
                  </span>
                  <span>
                    <strong>{t.tool.name}</strong>
                    <span className="text-ink-2">
                      {" "}
                      · about {t.hours} {t.hours === 1 ? "hour" : "hours"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <ButtonLink href="/setup" size="lg" className="no-print w-full">
              Start setting up
              <ArrowRight aria-hidden className="size-5" />
            </ButtonLink>
          </Card>
        </Reveal>
      </div>

      {plan.issues.length > 0 ? (
        <Reveal>
          <details className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-lg font-bold">
              <TriangleAlert aria-hidden className="size-5" />
              Things to watch ({plan.issues.length})
            </summary>
            <ul className="mt-3 space-y-4">
              {plan.issues.map((issue) => (
                <li
                  key={`${issue.title}-${issue.reason.rule}-${issue.reason.message}`}
                  className={`state-${issue.state} space-y-1 border-l-4 pl-3`}
                  style={{ borderColor: "var(--state-line)" }}
                >
                  <p className="font-semibold">
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
          </details>
        </Reveal>
      ) : null}

      <Reveal as="section" aria-label="Free help">
        <SbaPanel urgent={urgent} />
      </Reveal>

      <Reveal as="section" aria-labelledby="save" className="no-print space-y-4 rounded-3xl p-7 text-center text-white sm:p-10" style={{ background: "var(--best-bg)" }}>
        <h2 id="save" className="text-3xl font-extrabold sm:text-4xl">
          That&apos;s your plan
        </h2>
        <p className="mx-auto max-w-xl text-lg text-white/85">
          Save it to get your own dashboard: track each tool as you set it up, and come back any time.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            className="inline-flex min-h-13 items-center gap-2 rounded-full bg-honey px-7 text-lg font-semibold text-[#10241d] transition-transform hover:scale-[1.02]"
          >
            <Save aria-hidden className="size-5" />
            Save my plan
          </button>
          {auth.enabled && !signedIn ? (
            <button
              type="button"
              onClick={() => save(true)}
              className="inline-flex min-h-13 items-center gap-2 rounded-full px-6 font-semibold text-white ring-2 ring-white/60 hover:bg-white/10"
            >
              Save to an account (any device)
            </button>
          ) : null}
        </div>
        <p className="flex items-center justify-center gap-1.5 text-sm text-white/75">
          {signedIn ? (
            <>
              <CloudCheck aria-hidden className="size-4" />
              Signed in: it saves to your account.
            </>
          ) : (
            "No account needed: it saves on this device."
          )}
          {state.savedAt ? (
            <Link href="/dashboard" className="ml-2 font-semibold text-white">
              Open my dashboard
            </Link>
          ) : null}
        </p>
      </Reveal>
    </div>
  );
}
