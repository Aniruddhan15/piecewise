import { describe, expect, it } from "vitest";
import { rawData } from "@/modules/taxonomy/catalog";
import {
  ADMIN_HOURS_CAP,
  formatHours,
  hoursBack,
  hoursRange,
  impactOf,
  marginFor,
  measureChange,
  outcomeFor,
  payback,
  sourcesFor,
} from "./outcomes";

describe("outcomes", () => {
  it("has a complete default story for every job", () => {
    for (const b of rawData.blocks) {
      const o = outcomeFor(b.id, []);
      expect(o, b.id).not.toBeNull();
      expect(o!.hours[0]).toBeLessThanOrEqual(o!.hours[1]);
    }
  });

  it("uses the wording for the owner's type of business when there is one", () => {
    const generic = outcomeFor("customer_comm", [])!;
    const hvac = outcomeFor("customer_comm", ["field_services"])!;
    expect(hvac.before).not.toBe(generic.before);
    expect(hvac.hours).toEqual(generic.hours);
  });

  it("covers the five common jobs for all nine kinds of business", () => {
    const common = ["customer_comm", "reviews", "marketing", "invoicing", "scheduling_payroll"];
    for (const a of rawData.archetypes) {
      for (const id of common) {
        const found = rawData.outcomes.some((o) => o.block === id && o.archetype === a.id);
        expect(found, `${a.id}/${id}`).toBe(true);
      }
    }
  });

  it("adds up hours once per job and rounds to half hours", () => {
    const one = hoursBack(["customer_comm"], []);
    const dup = hoursBack(["customer_comm", "customer_comm"], []);
    expect(dup).toEqual(one);
    // Two jobs overlap, so the 4 hours become 3.
    expect(hoursBack(["customer_comm", "reviews"], []).low).toBe(3);
    expect(hoursBack([], [])).toEqual({ low: 0, high: 0, mid: 0, jobs: 0 });
  });

  it("has a before/after measure that moves the right way for every job", () => {
    for (const b of rawData.blocks) {
      const o = outcomeFor(b.id, [])!;
      const { before, after, better } = o.measure;
      expect(better === "higher" ? after > before : after < before, b.id).toBe(true);
    }
  });

  it("only gives a dollar figure to jobs we can back with a stated assumption", () => {
    for (const b of rawData.blocks) {
      const o = outcomeFor(b.id, [])!;
      if (!o.money) continue;
      expect(o.money.low, b.id).toBeLessThanOrEqual(o.money.high);
      expect(o.money.assumption.length, b.id).toBeGreaterThan(10);
    }
    for (const id of ["legal", "hipaa", "food_safety", "permits", "subcontractors", "channel_mgmt"]) {
      expect(outcomeFor(id, [])!.money, id).toBeNull();
    }
  });

  it("varies the dollars by kind of business for the five common jobs", () => {
    for (const id of ["customer_comm", "reviews", "marketing", "invoicing", "scheduling_payroll"]) {
      for (const a of rawData.archetypes) {
        const o = outcomeFor(id, [a.id])!;
        const entry = rawData.impact.find((i) => i.block === id)!;
        expect(entry.by_archetype?.[a.id], `${id}/${a.id}`).toBeTruthy();
        expect(o.money!.assumption).toBe(entry.by_archetype![a.id]!.money.assumption);
      }
    }
    // A missed call is worth much more to an HVAC company than to a coffee shop.
    expect(outcomeFor("customer_comm", ["field_services"])!.money!.low).toBeGreaterThan(
      outcomeFor("customer_comm", ["food_bev"])!.money!.low,
    );
  });

  it("counts sales at a profit margin and discounts overlapping jobs", () => {
    const one = impactOf(["customer_comm"], []);
    // 300 to 1,200 of sales at 30% profit.
    expect(one.cash.low).toBe(90);
    expect(one.cash.high).toBe(360);
    expect(one.overlap).toBe(1);

    const two = impactOf(["customer_comm", "accounting"], []);
    // Profit 90 + savings 50 = 140 low, 360 + 150 = 510 high, then 25% off for overlap.
    expect(two.overlap).toBe(0.75);
    expect(two.cash.low).toBe(110);
    expect(two.cash.high).toBe(380);
    expect(two.cash.mid % 10).toBe(0);
    expect(two.sales.low).toBeGreaterThan(0);
  });

  it("puts no dollar figure on jobs that only avoid problems", () => {
    const t = impactOf(["legal", "hipaa"], []);
    expect(t.jobs).toBe(2);
    expect(t.moneyJobs).toBe(0);
    expect(t.cash).toEqual({ low: 0, high: 0, mid: 0 });
    expect(t.overlap).toBe(1);
  });

  it("describes a change in words", () => {
    expect(measureChange({ label: "x", unit: "%", before: 60, after: 98, better: "higher", confidence: "guess" })).toBe("38 points higher");
    expect(measureChange({ label: "x", unit: " min", before: 120, after: 20, better: "lower", confidence: "guess" })).toBe("83% less");
  });

  it("projects payback with the tool cost and setup time", () => {
    const p = payback({
      cash: { low: 200, high: 400 },
      hours: { low: 2, high: 4 },
      hourlyValue: 0,
      monthlyCost: 100,
      setupHours: 5,
    });
    expect(p.points).toHaveLength(13);
    expect(p.points[0].mid).toBe(0);
    // Steady state is 300 in, 100 out. Gains build up over three months: 0, 100, then 200 a month.
    expect(p.monthly).toEqual({ low: 100, mid: 200, high: 300 });
    expect(p.points[1].mid).toBe(0);
    expect(p.points[2].mid).toBe(100);
    expect(p.points[12].mid).toBe(2100);
    expect(p.breakEven).toBe(0);
    // The cautious line (200 in, 100 out at steady state) takes a little longer to turn positive.
    expect(p.breakEvenLow).toBeGreaterThan(0);
    expect(p.breakEvenLow).toBeLessThanOrEqual(3);

    const withTime = payback({
      cash: { low: 200, high: 400 },
      hours: { low: 2, high: 4 },
      hourlyValue: 20,
      monthlyCost: 100,
      setupHours: 5,
    });
    expect(withTime.points[0].mid).toBe(-100);
    expect(withTime.breakEven).toBeGreaterThan(1);
    expect(withTime.breakEven).toBeLessThan(2);
  });

  it("says when it never pays back inside the window", () => {
    const p = payback({
      cash: { low: 10, high: 30 },
      hours: { low: 0, high: 0 },
      hourlyValue: 0,
      monthlyCost: 100,
      setupHours: 0,
    });
    expect(p.points[12].mid).toBeLessThan(0);
    expect(p.breakEven).toBeNull();
    expect(p.breakEvenLow).toBeNull();
  });

  it("uses a thinner profit margin for construction", () => {
    expect(marginFor(["food_bev"])).toBe(0.3);
    expect(marginFor(["construction"])).toBe(0.15);
    const hvac = impactOf(["customer_comm"], ["field_services"]);
    const build = impactOf(["customer_comm"], ["construction"]);
    expect(build.margin).toBe(0.15);
    // Same kind of job, half the profit on each sale.
    expect(build.cash.low / build.sales.low).toBeCloseTo(0.15, 1);
    expect(hvac.cash.low / hvac.sales.low).toBeCloseTo(0.3, 1);
  });

  it("never claims more time back than half the admin hours owners report", () => {
    const all = rawData.blocks.map((b) => b.id);
    const t = impactOf(all, []);
    expect(t.hoursCapped).toBe(true);
    expect(t.hours.high).toBeLessThanOrEqual(ADMIN_HOURS_CAP);
    expect(t.hours.low).toBeLessThanOrEqual(t.hours.high);
    expect(impactOf(["reviews"], []).hoursCapped).toBe(false);
  });

  it("labels every number and links the ones that claim a source", () => {
    for (const i of rawData.impact) {
      const nums = [i.measure, i.money, ...Object.values(i.by_archetype ?? {}).map((x) => x?.money)].filter(Boolean);
      for (const n of nums) {
        expect(["sourced", "vendor", "guess"]).toContain(n!.confidence);
        expect(Boolean(n!.source), i.block).toBe(n!.confidence !== "guess");
      }
    }
  });

  it("lists each source once with what it supports, plus the margin and time sources", () => {
    const list = sourcesFor(["patient_scheduling", "booking"], ["clinics"]);
    const noShow = list.filter((s) => s.url.includes("PMC3188816"));
    expect(noShow).toHaveLength(1);
    expect(noShow[0].supports).toContain("Keep patients coming back");
    expect(list.some((s) => s.supports.includes("Profit margin on extra sales"))).toBe(true);
    expect(list.some((s) => s.supports.includes("Cap on hours back"))).toBe(true);
  });

  it("leads each card with a metric that fits the job, not always hours", () => {
    const kinds = new Set<string>();
    for (const b of rawData.blocks) {
      const o = outcomeFor(b.id, [])!;
      kinds.add(o.headline);
      // A money headline always has a dollar figure behind it.
      if (o.headline === "money") expect(o.money, b.id).not.toBeNull();
    }
    expect([...kinds].sort()).toEqual(["measure", "money", "time"]);
    expect(outcomeFor("customer_comm", [])!.headline).toBe("money");
    expect(outcomeFor("invoicing", [])!.headline).toBe("measure");
    expect(outcomeFor("accounting", [])!.headline).toBe("time");
  });

  it("falls back to hours when a job leads with money but has no dollar figure", () => {
    const entries = rawData.outcomes;
    const impact = rawData.impact.map((i) => (i.block === "customer_comm" ? { ...i, money: null, by_archetype: undefined } : i));
    expect(outcomeFor("customer_comm", [], entries, impact)!.headline).toBe("time");
  });

  it("keeps the before and after sentences short and free of jargon", () => {
    const jargon = /takeoff|\blien\b|\bBAA\b|\bSMS\b|reconcil|ledger|dispatch|omnichannel|\bsync\b/i;
    for (const o of rawData.outcomes) {
      for (const text of [o.before, o.after]) {
        expect(text.length, text).toBeLessThanOrEqual(90);
        expect(jargon.test(text), text).toBe(false);
      }
    }
  });

  it("formats ranges plainly", () => {
    expect(hoursRange(3, 6)).toBe("3 to 6 hours");
    expect(hoursRange(1, 1)).toBe("1 hour");
    expect(formatHours(4.5)).toBe("4.5");
  });
});
