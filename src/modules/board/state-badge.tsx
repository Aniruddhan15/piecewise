import {
  ArrowRight,
  Ban,
  Check,
  Clock,
  Lock,
  ShieldAlert,
  Sigma,
  Tag,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReasonIcon, VisibleState } from "@/modules/taxonomy/types";
import { cn } from "@/components/ui";

export const STATE_INFO: Record<
  VisibleState,
  { label: string; icon: LucideIcon; meaning: string }
> = {
  fits: { label: "Works with your setup", icon: Check, meaning: "Connects with what you already run." },
  catch: { label: "Works, with a catch", icon: TriangleAlert, meaning: "Works, but there's something to watch or pay for." },
  no_fit: { label: "Won't work for you", icon: Ban, meaning: "Can't connect the way you'd need." },
  not_allowed: { label: "Not allowed for you", icon: ShieldAlert, meaning: "May connect, but rules say you can't use it this way." },
};

export const REASON_ICON: Record<ReasonIcon, LucideIcon> = {
  arrow: ArrowRight,
  sigma: Sigma,
  clock: Clock,
  wrench: Wrench,
  tag: Tag,
  lock: Lock,
  shield: ShieldAlert,
};

export function StateBadge({
  state,
  className,
}: {
  state: VisibleState;
  className?: string;
}) {
  const info = STATE_INFO[state];
  const Icon = info.icon;
  return (
    <span
      className={cn(
        `state-${state}`,
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold",
        className,
      )}
      style={{
        color: "var(--state)",
        background: "var(--state-tint)",
        borderColor: "var(--state-line)",
      }}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {info.label}
    </span>
  );
}
