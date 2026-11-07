"use client";

import { Anchor, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { useStore } from "@/modules/board/store";
import { resolveAnchor } from "@/modules/compat-engine/engine";
import { catalog } from "@/modules/taxonomy/catalog";
import type { AccountingEdition, BusinessProfile, Device, Tool } from "@/modules/taxonomy/types";

const PAPER = "__paper";
const NONE = "__none";

const CHANNELS = [
  { id: "phone", label: "Phone calls" },
  { id: "text", label: "Text messages" },
  { id: "email", label: "Email" },
  { id: "google_profile", label: "Google Business Profile" },
  { id: "social", label: "Facebook or Instagram" },
  { id: "website", label: "My website" },
];

const DEVICES: { id: Device; label: string }[] = [
  { id: "ios", label: "iPhone or iPad" },
  { id: "android", label: "Android" },
  { id: "windows", label: "Windows computer" },
  { id: "web", label: "Any web browser" },
];

type Slot = "payments_pos" | "customer_records" | "accounting";

/** Option lists filtered by archetype (M4.F1). Names only, no logos. */
function optionsFor(slot: Slot, profile: BusinessProfile): Tool[] {
  return catalog.tools.filter((t) => {
    if (t.kind !== "base_system" || !t.slots?.includes(slot)) return false;
    if (t.archetypes === "all") return true;
    return t.archetypes.some((a) => profile.archetypes.includes(a));
  });
}

function SystemSelect({
  id,
  label,
  help,
  slot,
  profile,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: React.ReactNode;
  slot: Slot;
  profile: BusinessProfile;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} help={help}>
      <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose one</option>
        {optionsFor(slot, profile).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        <option value={PAPER}>Paper or a spreadsheet</option>
        <option value={NONE}>Nothing yet</option>
      </select>
    </Field>
  );
}

export function BaseForm() {
  const router = useRouter();
  const { state, setProfile } = useStore();
  const { profile } = state;
  const anchor = resolveAnchor({ ...profile, anchor: undefined }, catalog);

  function setSlot(slot: "payments_pos" | "customer_records", value: string) {
    setProfile((p) => {
      const base = { ...p.base, [slot]: value && !value.startsWith("__") ? value : undefined };
      const next = { ...p, base, anchor: undefined };
      return { ...next, anchor: resolveAnchor(next, catalog)?.id };
    });
  }

  function setAccounting(value: string) {
    setProfile((p) => ({
      ...p,
      base: {
        ...p.base,
        accounting: value && !value.startsWith("__") ? value : undefined,
        accounting_edition:
          value === PAPER
            ? "spreadsheet"
            : value === NONE
              ? "none"
              : ((value || undefined) as AccountingEdition | undefined),
      },
    }));
  }

  const accountingValue =
    profile.base.accounting ??
    (profile.base.accounting_edition === "spreadsheet"
      ? PAPER
      : profile.base.accounting_edition === "none"
        ? NONE
        : "");

  const anchorTiers = (anchor?.tiers ?? []).filter((t) => t.name !== "Quote");

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/matches");
      }}
    >
      <Card className="grid gap-5 md:grid-cols-2">
        <SystemSelect
          id="payments"
          label="How do you take payments?"
          slot="payments_pos"
          profile={profile}
          value={profile.base.payments_pos ?? ""}
          onChange={(v) => setSlot("payments_pos", v)}
        />
        <SystemSelect
          id="records"
          label="Where do you keep customer records?"
          slot="customer_records"
          profile={profile}
          value={profile.base.customer_records ?? ""}
          onChange={(v) => setSlot("customer_records", v)}
        />
        <div className="md:col-span-2">
          <SystemSelect
            id="accounting"
            label="What do you use for your books?"
            help={
              <details>
                <summary className="min-h-11 cursor-pointer py-2">
                  Not sure which QuickBooks you have?
                </summary>
                If you sign in at a website from any computer, it&apos;s QuickBooks Online. If it&apos;s
                a program installed on your office computer, it&apos;s QuickBooks Desktop. This matters:
                many tools only work with one of them.
              </details>
            }
            slot="accounting"
            profile={profile}
            value={accountingValue}
            onChange={setAccounting}
          />
        </div>
        <fieldset className="md:col-span-2">
          <legend className="mb-1.5 font-semibold">How do customers reach you?</legend>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={profile.base.channels.includes(c.id)}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      base: {
                        ...p.base,
                        channels: e.target.checked
                          ? [...p.base.channels, c.id]
                          : p.base.channels.filter((x) => x !== c.id),
                      },
                    }))
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      {profile.mobile ? (
        <Card className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 font-semibold">What do your team use in the field?</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {DEVICES.map((d) => (
                <label key={d.id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={profile.devices.includes(d.id)}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        devices: e.target.checked
                          ? [...p.devices, d.id]
                          : p.devices.filter((x) => x !== d.id),
                      }))
                    }
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 font-semibold">How is your signal on the job?</legend>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  { value: "reliable", label: "Reliable" },
                  { value: "unreliable", label: "Often drops" },
                ] as const
              ).map((opt) => (
                <label key={opt.value} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="connectivity"
                    className="size-5"
                    checked={profile.connectivity === opt.value}
                    onChange={() => setProfile((p) => ({ ...p, connectivity: opt.value }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
      ) : null}

      <Card aria-live="polite" className="space-y-3">
        {anchor ? (
          <>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Anchor aria-hidden className="size-5 text-brand" />
              Your main system: {anchor.name}
            </h2>
            <p className="text-ink-2">
              It runs your customers and money, so every other tool has to fit around it. We check
              each suggestion against {anchor.name} first.
            </p>
            {anchorTiers.length > 1 ? (
              <Field
                id="tier"
                label={`Which ${anchor.name} plan are you on?`}
                help="Some connections only work on certain plans."
              >
                <select
                  id="tier"
                  className={inputClass}
                  value={profile.selected_tiers[anchor.id] ?? ""}
                  onChange={(e) =>
                    setProfile((p) => {
                      const selected_tiers = { ...p.selected_tiers };
                      if (e.target.value) selected_tiers[anchor.id] = e.target.value;
                      else delete selected_tiers[anchor.id];
                      return { ...p, selected_tiers };
                    })
                  }
                >
                  <option value="">Not sure</option>
                  {anchorTiers.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        ) : (
          <p className="flex gap-2 text-ink-2">
            <Info aria-hidden className="mt-1 size-5 shrink-0" />
            No main system yet? That&apos;s fine. It sits at the center of your kit, and
            we&apos;ll suggest options that suit your kind of business.
          </p>
        )}
      </Card>

      <Button type="submit" size="lg">
        Next: see my picks
      </Button>
    </form>
  );
}
