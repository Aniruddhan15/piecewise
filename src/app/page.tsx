import { ArrowRight, Building2, Coffee, Flame, Leaf, Stethoscope, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { STATE_INFO, StateBadge } from "@/modules/board/state-badge";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import type { VisibleState } from "@/modules/taxonomy/types";

const DEMO_ICON: Record<string, typeof Coffee> = {
  restaurant: UtensilsCrossed,
  coffee: Coffee,
  hvac: Flame,
  landscaper: Leaf,
  dental: Stethoscope,
};

const STATES: VisibleState[] = ["fits", "catch", "no_fit", "not_allowed"];

export default function Home() {
  const edges = catalog.edges.filter((e) => e.verified && e.type !== "none").length;
  return (
    <div className="space-y-12">
      <section className="max-w-3xl space-y-4 pt-2">
        <h1 className="text-4xl font-bold sm:text-5xl">
          Find AI tools that actually fit your business
        </h1>
        <p className="text-lg text-ink-2 sm:text-xl">
          Tell us what you already run. We show which AI tools connect to it, what they really
          cost, and what to set up first. No sign-up, and we never sell you anything.
        </p>
        <ButtonLink href="/start" size="lg">
          Start with my business
          <ArrowRight aria-hidden className="size-5" />
        </ButtonLink>
      </section>

      <section aria-labelledby="demos" className="space-y-4">
        <h2 id="demos" className="text-2xl font-bold">
          Or try a demo business
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => {
            const Icon = DEMO_ICON[d.id] ?? Building2;
            return (
              <li key={d.id}>
                <Link
                  href={`/board?demo=${d.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-ink no-underline transition-colors hover:border-brand"
                >
                  <span className="flex items-center gap-2 text-lg font-semibold">
                    <Icon aria-hidden className="size-5 shrink-0 text-brand" />
                    {d.label}
                  </span>
                  <span className="text-ink-2">{d.blurb}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="states" className="space-y-4">
        <h2 id="states" className="text-2xl font-bold">
          Every tool gets a straight answer
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {STATES.map((s) => (
            <li key={s}>
              <Card className="h-full space-y-2">
                <StateBadge state={s} />
                <p className="text-ink-2">{STATE_INFO[s].meaning}</p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="text-ink-2">
          Each answer shows its reason and a link to the source. We&apos;ve checked {edges}{" "}
          connections against their source pages so far, and anything we haven&apos;t confirmed is
          labeled unverified. Rankings come only from fit: no vendor can pay for a spot.
        </p>
      </section>
    </div>
  );
}
