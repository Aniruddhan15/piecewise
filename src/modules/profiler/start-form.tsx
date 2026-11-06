"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, inputClass } from "@/components/ui";
import { useStore } from "@/modules/board/store";
import { callTask } from "@/modules/llm/client-api";
import { catalog, naicsMap } from "@/modules/taxonomy/catalog";
import type { ArchetypeId } from "@/modules/taxonomy/types";

const EXAMPLES = [
  "A family restaurant with 12 staff",
  "A neighborhood coffee shop with 5 staff",
  "A two-truck HVAC company",
  "A landscaping company with a crew of 6",
];

type Classified = {
  archetypes: ArchetypeId[];
  naics: { code: string; title: string };
  confidence: number;
  suggested_extra_blocks: string[];
};

export function StartForm() {
  const router = useRouter();
  const { ready, state, setProfile, setSuggested } = useStore();
  const { profile } = state;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [regulatedYes, setRegulatedYes] = useState(profile.regulated !== "none");

  const selected = profile.archetypes;

  function toggle(id: ArchetypeId) {
    setProfile((p) => ({
      ...p,
      archetypes: p.archetypes.includes(id)
        ? p.archetypes.filter((a) => a !== id)
        : [...p.archetypes, id],
    }));
  }

  async function classify(text: string) {
    if (text.trim().length < 3) {
      setNote("Add a few words about your business, or pick from the list below.");
      return;
    }
    setBusy(true);
    setNote(null);
    const result = await callTask<Classified>("classify_business", { description: text });
    setBusy(false);
    if (!result || result.archetypes.length === 0) {
      setNote("We couldn't work that out automatically. Please pick from the list below.");
      return;
    }
    setProfile((p) => ({ ...p, archetypes: result.archetypes, naics: result.naics }));
    setSuggested(result.suggested_extra_blocks.filter((id) => catalog.blockById.has(id)));
    setNote("Here's our best guess. Remove or add anything below.");
  }

  const questions = selected.flatMap(
    (id) => catalog.archetypeById.get(id)?.regulated_question ?? [],
  );
  const naics = profile.naics ?? (selected[0] ? naicsMap[selected[0]]?.[0] : undefined);

  if (!ready) return null;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/base");
      }}
    >
      <Card className="space-y-4">
        <Field
          id="description"
          label="Describe your business in a sentence"
          help="Don't include customer or patient details. We only need to know what kind of business this is."
        >
          <textarea
            id="description"
            rows={2}
            className={inputClass}
            value={profile.description}
            onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm text-ink-2" id="examples-label">
            Or try an example:
          </p>
          <ul aria-labelledby="examples-label" className="flex flex-wrap gap-2">
            {EXAMPLES.map((text) => (
              <li key={text}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setProfile((p) => ({ ...p, description: text }));
                    void classify(text);
                  }}
                >
                  {text}
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={() => void classify(profile.description)} disabled={busy}>
          <Sparkles aria-hidden className="size-4" />
          {busy ? "Working it out…" : "Find my business type"}
        </Button>
        <p role="status" className="min-h-6 text-ink-2">
          {note}
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">What kind of business is this?</h2>
        {selected.length > 0 ? (
          <ul aria-label="Selected business types" className="flex flex-wrap gap-2">
            {selected.map((id) => (
              <li key={id}>
                <Chip className="py-1 pr-1 font-semibold">
                  {catalog.archetypeById.get(id)?.name}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${catalog.archetypeById.get(id)?.name}`}
                    className="flex size-7 items-center justify-center rounded-full hover:bg-surface"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">Pick one or more. Many businesses are a mix.</p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.archetypes.map((a) => {
            const on = selected.includes(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(a.id)}
                  className={`flex h-full w-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    {on ? <Check aria-hidden className="size-4 text-brand" /> : null}
                    {a.name}
                  </span>
                  <span className="text-sm text-ink-2">{a.examples.join(", ")}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {naics ? (
          <p className="text-sm text-ink-2">
            Likely industry code: <strong>{naics.code}</strong> ({naics.title}). The SBA uses this
            code when it decides which programs and size standards apply to you.
          </p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">A few quick questions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="employees" label="How many employees?" help="Not counting you.">
            <input
              id="employees"
              type="number"
              min={0}
              className={inputClass}
              value={profile.employees}
              onChange={(e) =>
                setProfile((p) => ({ ...p, employees: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </Field>
          <Field id="locations" label="How many locations?">
            <input
              id="locations"
              type="number"
              min={1}
              className={inputClass}
              value={profile.locations}
              onChange={(e) =>
                setProfile((p) => ({ ...p, locations: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </Field>
          <Field
            id="budget"
            label="Monthly budget for new tools (optional)"
            help="If you leave this empty we'll use $200."
          >
            <input
              id="budget"
              type="number"
              min={0}
              inputMode="numeric"
              className={inputClass}
              value={profile.monthly_budget_usd ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  monthly_budget_usd: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
            />
          </Field>
          <fieldset className="space-y-1.5">
            <legend className="font-semibold">Where do you work?</legend>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "At a storefront or office", value: false },
                { label: "I go to customers", value: true },
              ].map((opt) => (
                <label key={opt.label} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="mobile"
                    className="size-5"
                    checked={profile.mobile === opt.value}
                    onChange={() => setProfile((p) => ({ ...p, mobile: opt.value }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {questions.map((q) => (
          <fieldset key={q.yes_value} className="space-y-1.5">
            <legend className="font-semibold">{q.prompt}</legend>
            <p className="text-sm text-ink-2">{q.help}</p>
            <div className="flex gap-4">
              {[true, false].map((yes) => (
                <label key={String(yes)} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name={q.yes_value}
                    className="size-5"
                    checked={yes ? profile.regulated === q.yes_value : profile.regulated !== q.yes_value}
                    onChange={() => {
                      setRegulatedYes(yes);
                      setProfile((p) => ({
                        ...p,
                        regulated: yes ? q.yes_value : p.regulated === q.yes_value ? "none" : p.regulated,
                      }));
                    }}
                  />
                  {yes ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {regulatedYes && profile.regulated === "hipaa" ? (
          <p className="text-sm text-ink-2">
            We&apos;ll check every tool for a BAA. PieceWise never asks for patient information.
          </p>
        ) : null}
      </Card>

      <Button type="submit" size="lg" disabled={selected.length === 0}>
        Next: what you already use
      </Button>
      {selected.length === 0 ? (
        <p className="text-sm text-ink-2">Pick at least one business type to continue.</p>
      ) : null}
    </form>
  );
}
