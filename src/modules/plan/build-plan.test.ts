import { describe, expect, it } from "vitest";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import { buildPlan } from "./build-plan";

const plan = (id: string) => {
  const demo = demos.find((d) => d.id === id)!;
  return buildPlan(demo.profile, demo.pieces, catalog);
};

describe("adoption plan", () => {
  it("a tool that isn't allowed adds no cost, no setup steps and no rollout step", () => {
    const p = plan("dental");
    expect(p.tools.some((t) => t.tool.id === "mailchimp")).toBe(true);
    expect(p.usable.some((t) => t.tool.id === "mailchimp")).toBe(false);
    expect(p.costLines.some((l) => l.label.includes("Mailchimp"))).toBe(false);
    expect(p.rollout.some((s) => s.title.includes("Mailchimp"))).toBe(false);
    expect(p.anyNotAllowed).toBe(true);
    expect(p.issues[0].state).toBe("not_allowed");
    expect(p.issues[0].reason.message).toMatch(/BAA/);
  });

  it("a tool that doesn't fit adds no cost", () => {
    const p = plan("restaurant");
    expect(p.costLines.some((l) => l.label.includes("NiceJob"))).toBe(false);
    expect(p.issues.some((i) => i.title.includes("NiceJob") && i.state === "no_fit")).toBe(true);
  });

  it("the Jobber upgrade is itemized in the total", () => {
    const p = plan("landscaper");
    const line = p.costLines.find((l) => l.label.includes("Upgrade Jobber to Connect"));
    expect(line?.monthly_usd).toBe(70);
    const sum = p.costLines.reduce((n, l) => n + (l.monthly_usd ?? 0), 0);
    expect(p.total).toBeCloseTo(sum);
  });

  it("Zapier appears once however many tools use it", () => {
    const demo = demos.find((d) => d.id === "coffee")!;
    const p = buildPlan(demo.profile, { ...demo.pieces, customer_comm: "rosie" }, catalog);
    expect(p.costLines.filter((l) => l.label.includes("Zapier")).length).toBe(1);
  });

  it("a blocked main-system connection comes first in the rollout", () => {
    expect(plan("hvac").rollout[0].title).toMatch(/main system/);
  });

  it("no plan is over budget without saying so", () => {
    for (const d of demos) {
      const p = plan(d.id);
      expect(p.overBudget).toBe(p.total > p.budget);
    }
  });
});
