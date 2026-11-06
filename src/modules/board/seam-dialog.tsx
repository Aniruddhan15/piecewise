"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { evaluateSeam } from "@/modules/compat-engine/engine";
import { catalog } from "@/modules/taxonomy/catalog";
import type { BusinessProfile, Reason, Seam, Tool } from "@/modules/taxonomy/types";
import { REASON_ICON, StateBadge } from "./state-badge";

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  return (
    <ul className="space-y-3">
      {reasons.map((r, i) => {
        const Icon = r.icon ? REASON_ICON[r.icon] : null;
        return (
          <li key={`${r.rule}-${i}`} className="flex gap-2">
            {Icon ? <Icon aria-hidden className="mt-1 size-4 shrink-0 text-ink-2" /> : null}
            <div className={Icon ? "" : "pl-6"}>
              <p>{r.message}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
                {r.evidence_url ? (
                  <a href={r.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1">
                    Source
                    <ExternalLink aria-hidden className="size-3" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : null}
                {r.unverified ? <span>Unverified</span> : null}
                {r.rule !== "OK" && r.rule !== "NOTE" ? (
                  <span title="The compatibility rule that fired">Rule {r.rule}</span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** "What if you moved your books?" re-runs the real engine with a different edition. */
function EditionWhatIf({
  seam,
  profile,
}: {
  seam: Seam;
  profile: BusinessProfile;
}) {
  if (seam.reasons[0]?.rule !== "R3") return null;
  const a = catalog.byId.get(seam.a);
  const b = catalog.byId.get(seam.b);
  if (!a || !b) return null;
  const accountingId = profile.base.accounting;
  const product: Tool | undefined = a.id === accountingId ? b : a;
  const target = product.editions_supported?.[0];
  if (!target) return null;
  const moved = catalog.byId.get(target);
  if (!moved) return null;
  const whatIf: BusinessProfile = {
    ...profile,
    base: { ...profile.base, accounting: target, accounting_edition: target },
  };
  const result = evaluateSeam(product, moved, whatIf, catalog);
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
      <h3 className="font-semibold">If you moved your books to {moved.name}</h3>
      <StateBadge state={result.visible} />
      <ReasonList reasons={result.reasons} />
    </div>
  );
}

export function SeamDialog({
  seam,
  profile,
  onClose,
}: {
  seam: Seam | null;
  profile: BusinessProfile;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (seam && !el.open) el.showModal();
    if (!seam && el.open) el.close();
  }, [seam]);

  const a = seam ? catalog.byId.get(seam.a)?.name : "";
  const b = seam ? catalog.byId.get(seam.b)?.name : "";

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="seam-title">
      {seam ? (
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="seam-title" className="text-xl font-bold">
              {a} and {b}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X aria-hidden className="size-5" />
            </Button>
          </div>
          <StateBadge state={seam.visible} />
          <ReasonList reasons={seam.reasons} />
          <EditionWhatIf seam={seam} profile={profile} />
        </div>
      ) : null}
    </dialog>
  );
}
