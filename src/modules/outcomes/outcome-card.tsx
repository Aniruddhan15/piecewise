"use client";

import {
  ArrowDown,
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  Landmark,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  PenLine,
  Percent,
  Phone,
  Receipt,
  Repeat,
  RotateCcw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Thermometer,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Utensils,
  X,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui";
import { ConfidenceChip, SourceLink } from "./confidence";
import { formatHours, formatMeasure, hoursRange, usd, type Confidence, type Outcome } from "./outcomes";

const ICONS: Record<string, LucideIcon> = {
  "bed-double": BedDouble,
  building: Building2,
  calendar: Calendar,
  "clipboard-list": ClipboardList,
  clock: Clock,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  "file-text": FileText,
  globe: Globe,
  landmark: Landmark,
  mail: Mail,
  megaphone: Megaphone,
  "message-square": MessageSquare,
  package: Package,
  "pen-line": PenLine,
  percent: Percent,
  phone: Phone,
  receipt: Receipt,
  repeat: Repeat,
  "rotate-ccw": RotateCcw,
  ruler: Ruler,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  star: Star,
  thermometer: Thermometer,
  "trending-up": TrendingUp,
  truck: Truck,
  "user-plus": UserPlus,
  users: Users,
  utensils: Utensils,
};

/** A friendly "about N hours" for the big number: a range is shown underneath. */
function bigNumber(low: number, high: number): string {
  return formatHours(Math.round(((low + high) / 2) * 2) / 2);
}

/** The one statement on the card: hours saved, money, or the before/after measure, whichever fits the job. */
function Headline({
  outcome,
  toolName,
  low,
  high,
}: {
  outcome: Outcome;
  toolName?: string;
  low: number;
  high: number;
}) {
  const { money, measure } = outcome;
  const who = toolName ? `With ${toolName}` : "With the right tool";
  let eyebrow: string;
  let statement: ReactNode;
  let sub: string | null = null;
  let Icon: LucideIcon = Clock;
  let confidence: Confidence = "guess";

  // The statement is set at the same size and weight as the Today / With-the-tool sentences above it.
  if (outcome.headline === "money" && money) {
    Icon = DollarSign;
    confidence = money.confidence;
    eyebrow = money.kind === "revenue" ? `${who}, you bring in` : `${who}, you spend less`;
    statement = (
      <>
        At least <span className="text-brand">{usd(money.low)}</span>{" "}
        {money.kind === "revenue" ? "more sales" : "less"} a month
      </>
    );
  } else if (outcome.headline === "measure") {
    Icon = TrendingUp;
    confidence = measure.confidence;
    eyebrow = measure.label;
    statement = (
      <>
        <span className="text-ink-2">{formatMeasure(measure, measure.before)}</span>
        <span aria-hidden className="mx-2 text-ink-2">
          →
        </span>
        <span className="sr-only"> to </span>
        <span className="text-brand">{formatMeasure(measure, measure.after)}</span>
      </>
    );
    sub = `From today to ${toolName ? `with ${toolName}` : "with the right tool"}`;
  } else {
    const n = bigNumber(low, high);
    eyebrow = `${who}, you save`;
    statement = (
      <>
        <span className="text-brand">{n}</span> {Number(n) === 1 ? "hour" : "hours"} per week saved
      </>
    );
    sub = `Likely ${hoursRange(low, high)} per week`;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-brand-soft p-4 sm:p-5">
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink">
        <Icon className="size-7" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-bold tracking-wide text-ink-2 uppercase">{eyebrow}</p>
        <p className="text-xl leading-snug font-bold sm:text-2xl">{statement}</p>
        {sub ? <p className="text-sm text-ink-2">{sub}</p> : null}
      </div>
      <ConfidenceChip confidence={confidence} />
    </div>
  );
}

/**
 * The before and after card: what the job feels like today, what it feels like with help,
 * and one clear statement of what that saves. Layered for different readers: the two sentences
 * and the one statement are enough on their own, and "How we got these numbers" holds the
 * money, the sources and the assumptions for anyone who wants to check them.
 */
export function OutcomeCard({
  outcome,
  jobName,
  toolName,
  setupHours,
  className,
}: {
  outcome: Outcome;
  jobName: string;
  toolName?: string;
  setupHours?: number;
  className?: string;
}) {
  const id = useId();
  const Icon = ICONS[outcome.icon] ?? Sparkles;
  const [low, high] = outcome.hours;
  const { money } = outcome;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "@container overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_10px_30px_-18px_rgb(15_29_24/0.35)]",
        className,
      )}
    >
      <h2
        id={`${id}-title`}
        className="flex items-center gap-2 border-b border-line bg-surface-2 px-5 py-3 text-sm font-bold tracking-wide text-ink-2 uppercase sm:px-6"
      >
        <Clock aria-hidden className="size-4" />
        What changes in your week
        <span className="sr-only">: {jobName}</span>
      </h2>

      <div className="grid gap-0 @2xl:grid-cols-[1fr_auto_1fr]">
        <div className="state-catch flex gap-4 p-5 sm:p-6" style={{ background: "var(--state-tint)" }}>
          <div className="relative shrink-0 self-start">
            <span
              aria-hidden
              className="flex size-14 items-center justify-center rounded-2xl bg-surface text-ink-2 shadow-sm"
              style={{ boxShadow: "inset 0 0 0 2px var(--state-line)" }}
            >
              <Icon className="size-7 opacity-60" />
            </span>
            <span
              aria-hidden
              className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full text-white"
              style={{ background: "var(--notallowed-line)" }}
            >
              <X className="size-3.5" strokeWidth={3} />
            </span>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold tracking-wide uppercase" style={{ color: "var(--state)" }}>
              Today
            </p>
            <p className="text-xl leading-snug font-bold sm:text-2xl">{outcome.before}</p>
          </div>
        </div>

        <div aria-hidden className="relative flex items-center justify-center @2xl:w-0">
          <span className="z-10 -my-4 flex size-10 items-center justify-center rounded-full bg-ink text-bg shadow-md @2xl:my-0 @2xl:size-12">
            <ArrowDown className="size-5 @2xl:hidden" />
            <ArrowRight className="hidden size-5 @2xl:block" />
          </span>
        </div>

        <div className="state-fits flex gap-4 p-5 pt-8 sm:p-6 sm:pt-8 @2xl:pt-6" style={{ background: "var(--state-tint)" }}>
          <div className="relative shrink-0 self-start">
            <span
              aria-hidden
              className="flex size-14 items-center justify-center rounded-2xl bg-surface shadow-sm"
              style={{ boxShadow: "inset 0 0 0 2px var(--state-line)", color: "var(--state)" }}
            >
              <Icon className="size-7" />
            </span>
            <span
              aria-hidden
              className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full text-white"
              style={{ background: "var(--state-line)" }}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold tracking-wide uppercase" style={{ color: "var(--state)" }}>
              {toolName ? `With ${toolName}` : "With the right tool"}
            </p>
            <p className="text-xl leading-snug font-bold sm:text-2xl">{outcome.after}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 border-t border-line p-5 sm:p-6">
        <Headline outcome={outcome} toolName={toolName} low={low} high={high} />

        <details className="group rounded-2xl bg-surface-2 p-3">
          <summary className="min-h-11 cursor-pointer font-semibold">How we got these numbers</summary>
          <div className="mt-2 space-y-2 text-ink-2">
            <p>
              <strong className="text-ink">Our estimates, not promises.</strong> They are for a typical small business
              like yours, so yours will be different.
            </p>
            <ul className="space-y-3">
              <li className="space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <strong className="text-ink">Time</strong>
                  <ConfidenceChip confidence="guess" />
                </p>
                <p>{outcome.assumption}</p>
              </li>
              {money ? (
                <li className="space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <strong className="text-ink">Money</strong>
                    <ConfidenceChip confidence={money.confidence} />
                  </p>
                  <p>
                    {money.kind === "revenue"
                      ? `At least ${usd(money.low)} a month in extra sales (about ${usd(Math.round(money.low * outcome.margin))} of it profit), and up to ${usd(money.high)}. `
                      : `At least ${usd(money.low)} a month not spent, and up to ${usd(money.high)}. `}
                    {money.assumption}
                    {money.kind === "revenue"
                      ? ` We count only ${Math.round(outcome.margin * 100)}% of extra sales as profit.`
                      : ""}
                  </p>
                  {money.source ? (
                    <p>
                      <SourceLink source={money.source} />
                    </p>
                  ) : null}
                </li>
              ) : null}
              <li className="space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <strong className="text-ink">Before and after</strong>
                  <ConfidenceChip confidence={outcome.measure.confidence} />
                </p>
                <p>
                  {outcome.measure.source
                    ? "The starting point and the change come from the source below. Yours may be higher or lower."
                    : "A typical starting point for a small business, and the change we expect. Yours may be higher or lower."}
                </p>
                {outcome.measure.source ? (
                  <p>
                    <SourceLink source={outcome.measure.source} />
                  </p>
                ) : null}
              </li>
            </ul>
            {toolName && setupHours ? (
              <p>
                It takes about {setupHours} {setupHours === 1 ? "hour" : "hours"} to set up {toolName}. After that the
                gains come back every week.
              </p>
            ) : null}
            <p>No vendor paid us for any of these numbers. Where a figure comes from a vendor&apos;s own data, it says so.</p>
          </div>
        </details>
      </div>
    </section>
  );
}
