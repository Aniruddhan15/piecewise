import { describe, expect, it } from "vitest";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import { blocksForProfile, matchBlock, passesFilters, starterBlocks } from "@/modules/matcher/match";
import { cheapestQualifyingTier } from "@/modules/plan/cost";
import type { Tool, Verdict } from "@/modules/taxonomy/types";
import { costScore, FIT_WEIGHTS, fitScore, integrationScore, setupScore, trustScore } from "./score";

const t = (id: string): Tool => catalog.byId.get(id) as Tool;
const verdict = (over: Partial<Verdict>): Verdict => ({
  toolId: "x",
  state: "snaps",
  visible: "fits",
  reasons: [],
  badges: [],
  extra_monthly_usd: 0,
  ...over,
});
const demo = (id: string) => demos.find((d) => d.id === id)!;
const block = (id: string) => catalog.blockById.get(id)!;

describe("M9 factors", () => {
  it("weights add up to 1", () => {
    const sum = Object.values(FIT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("integration: fits 100, catch 70, needs upgrade 50", () => {
    expect(integrationScore(verdict({}))).toBe(100);
    expect(integrationScore(verdict({ state: "snaps_adapter", visible: "catch" }))).toBe(70);
    expect(integrationScore(verdict({ state: "needs_upgrade", visible: "catch" }))).toBe(50);
  });

  it("setup bands", () => {
    const mk = (h: number, noCode = true) => ({ ...t("rosie"), setup: { ...t("rosie").setup, hours_estimate: h, no_code: noCode } });
    expect(setupScore(mk(1))).toBe(100);
    expect(setupScore(mk(1, false))).toBe(80);
    expect(setupScore(mk(4))).toBe(80);
    expect(setupScore(mk(8))).toBe(60);
    expect(setupScore(mk(20))).toBe(30);
  });

  it("cost bands against a $200 budget", () => {
    expect(costScore(0, 200, true).score).toBe(100);
    expect(costScore(50, 200, false).score).toBe(90);
    expect(costScore(100, 200, false).score).toBe(70);
    expect(costScore(200, 200, false).score).toBe(50);
    expect(costScore(449, 200, false)).toEqual({ score: 10, over: true });
  });

  it("trust combines best evidence grade and privacy", () => {
    const base = { ...t("rosie"), evidence: [{ claim: "c", url: "https://a.example/", grade: 1 as const }] };
    expect(trustScore({ ...base, privacy: { trains_on_customer_data: false } })).toBe(100);
    expect(trustScore({ ...base, privacy: { trains_on_customer_data: null } })).toBe(80);
    expect(trustScore({ ...base, privacy: { trains_on_customer_data: true } })).toBe(60);
  });

  it("no score for tools that don't fit", () => {
    const p = demo("hvac").profile;
    expect(fitScore(t("rosie"), verdict({ state: "doesnt_fit", visible: "no_fit" }), p, 49)).toBeNull();
    expect(fitScore(t("rosie"), verdict({ state: "not_allowed", visible: "not_allowed" }), p, 49)).toBeNull();
  });
});

describe("true cost (P3)", () => {
  it("Marlie's price is the $99 tier that books, not the $49 entry tier", () => {
    const p = demo("hvac").profile;
    expect(cheapestQualifyingTier(t("marlie"), p, catalog)).toBe("Standard");
  });
});

describe("matcher on the HVAC demo (M7 accept)", () => {
  const p = demo("hvac").profile;
  const chosen = Object.values(demo("hvac").pieces).map(t);
  const results = matchBlock(block("customer_comm"), p, chosen, catalog);

  it("Jobber AI Receptionist shows as already included / add-on", () => {
    const card = results.included.find((i) => i.toolId === "jobber_ai_receptionist");
    expect(card).toBeTruthy();
    expect(card?.addon_monthly_usd).toBe(29);
  });

  it("Rosie is a catch", () => {
    expect(results.catches.some((m) => m.tool.id === "rosie")).toBe(true);
  });

  it("Sameday is flagged over budget and hidden by the Under budget filter", () => {
    const all = [...results.fits, ...results.catches];
    const sameday = all.find((m) => m.tool.id === "sameday");
    expect(sameday?.fit?.over_budget).toBe(true);
    expect(sameday && passesFilters(sameday, { underBudget: true }, p)).toBe(false);

    const filtered = matchBlock(block("customer_comm"), p, chosen, catalog, { underBudget: true });
    expect([...filtered.fits, ...filtered.catches].some((m) => m.tool.id === "sameday")).toBe(false);
  });

  it("results are ranked by fit score within a group", () => {
    const scores = results.catches.map((m) => m.fit?.total ?? 0);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("board composition (M5)", () => {
  it("conditional pieces follow the profile", () => {
    const p = demo("restaurant").profile;
    const ids = blocksForProfile(p, catalog).map((b) => b.id);
    expect(ids).toContain("scheduling_payroll");
    expect(ids).not.toContain("multi_location");
    const solo = blocksForProfile({ ...p, employees: 0 }, catalog).map((b) => b.id);
    expect(solo).not.toContain("scheduling_payroll");
  });

  it("only this archetype's pieces show", () => {
    const ids = blocksForProfile(demo("restaurant").profile, catalog).map((b) => b.id);
    expect(ids).toContain("recipe_costing");
    expect(ids).not.toContain("dispatch");
  });

  it("starter pieces come in archetype order", () => {
    expect(starterBlocks(demo("hvac").profile, catalog)).toEqual(["customer_comm", "estimates", "reviews"]);
  });

  it("every archetype renders from data alone", () => {
    for (const a of catalog.archetypes) {
      const blocks = blocksForProfile({ ...demo("hvac").profile, archetypes: [a.id] }, catalog);
      expect(blocks.length).toBeGreaterThan(10);
      for (const s of a.starter_blocks) expect(catalog.blockById.has(s)).toBe(true);
    }
  });
});

describe("Toast restaurant", () => {
  const p = demo("restaurant").profile;
  it("recipe costing says xtraCHEF is already included first", () => {
    const r = matchBlock(block("recipe_costing"), p, [], catalog);
    expect(r.included.length).toBeGreaterThan(0);
    expect(r.fits.some((m) => m.tool.id === "marginedge")).toBe(true);
  });
  it("Payments lists Stripe with a real R1 verdict", () => {
    const r = matchBlock(block("payments_pos"), p, [], catalog);
    const stripe = r.baseOptions.find((m) => m.tool.id === "stripe");
    expect(stripe?.verdict.reasons[0].rule).toBe("R1");
  });
});
