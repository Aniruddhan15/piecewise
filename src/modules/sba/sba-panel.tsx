import { ExternalLink, LifeBuoy } from "lucide-react";
import { Card } from "@/components/ui";
import { catalog } from "@/modules/taxonomy/catalog";

function ResourceLink({ id }: { id: string }) {
  const r = catalog.sba.find((s) => s.id === id);
  if (!r) return null;
  return (
    <li>
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold">
        {r.name}
        <ExternalLink aria-hidden className="size-3" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <p className="text-sm text-ink-2">{r.description}</p>
    </li>
  );
}

/** Free help: all of these are public programs, and none pay us. */
export function SbaPanel({ urgent }: { urgent?: string }) {
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <LifeBuoy aria-hidden className="size-5 text-brand" />
        Talk to a free advisor before you buy
      </h2>
      {urgent ? <p className="font-medium">{urgent}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {["md_sbdc_request", "md_sbdc_locations", "sbdc_locator", "score", "sba_learning", "lender_match"].map((id) => (
          <ResourceLink key={id} id={id} />
        ))}
      </ul>
    </Card>
  );
}

/** One contextual SBA pointer on a block page (M12.F2). */
export function SbaHint({ id }: { id: string }) {
  const r = catalog.sba.find((s) => s.id === id);
  if (!r) return null;
  return (
    <p className="text-ink-2">
      Free help:{" "}
      <a href={r.url} target="_blank" rel="noopener noreferrer">
        {r.name}
      </a>
      . {r.description}
    </p>
  );
}
