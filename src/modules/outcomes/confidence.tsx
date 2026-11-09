"use client";

import { BadgeCheck, ExternalLink, HelpCircle, Store } from "lucide-react";
import { cn } from "@/components/ui";
import { CONFIDENCE_HELP, CONFIDENCE_LABEL, type Confidence } from "./outcomes";

const STYLE: Record<Confidence, { cls: string; Icon: typeof BadgeCheck }> = {
  sourced: { cls: "state-fits", Icon: BadgeCheck },
  vendor: { cls: "state-catch", Icon: Store },
  guess: { cls: "state-base", Icon: HelpCircle },
};

/** Says where a sourced or vendor-backed number came from, in words and an icon, never color alone. */
export function ConfidenceChip({ confidence, className }: { confidence: Confidence; className?: string }) {
  // Our own estimates carry no tag: only numbers with a source say where they came from.
  if (confidence === "guess") return null;
  const { cls, Icon } = STYLE[confidence];
  return (
    <span
      title={CONFIDENCE_HELP[confidence]}
      className={cn(
        cls,
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold",
        className,
      )}
      style={{ background: "var(--state-tint)", color: "var(--state)", boxShadow: "inset 0 0 0 1px var(--state-line)" }}
    >
      <Icon aria-hidden className="size-3.5" />
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

/** A link to where a number came from. Opens in a new tab and says so to screen readers. */
export function SourceLink({ source }: { source: { label: string; url: string } }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold"
    >
      {source.label}
      <ExternalLink aria-hidden className="size-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
