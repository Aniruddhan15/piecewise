import { describe, expect, it } from "vitest";
import { buildPlan } from "@/modules/plan/build-plan";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import { nextUnfinished, overallProgress, percent, setupSequence, toolKeys, toolProgress } from "./progress";

const demo = (id: string) => {
  const d = demos.find((x) => x.id === id);
  if (!d) throw new Error(`no demo ${id}`);
  return d;
};

describe("setup sequence", () => {
  it("lists each tool once, even when it fills two jobs", () => {
    const profile = { ...demo("coffee").profile, archetypes: ["lodging" as const] };
    const plan = buildPlan(profile, { housekeeping: "breezeway", guest_messaging: "breezeway" }, catalog);
    const seq = setupSequence(plan, profile, catalog);
    expect(seq.filter((t) => t.tool.id === "breezeway")).toHaveLength(1);
    expect(seq[0].jobs).toHaveLength(2);
    expect(plan.rollout.filter((s) => s.toolId === "breezeway")).toHaveLength(1);
  });

  it("leaves sign-up steps out of part 2, since part 1 covers the account", () => {
    const { profile, pieces } = demo("coffee");
    const seq = setupSequence(buildPlan(profile, pieces, catalog), profile, catalog);
    const homebase = seq.find((t) => t.tool.id === "homebase");
    expect(homebase).toBeDefined();
    const shown = homebase!.setupIdx.map((i) => homebase!.tool.setup.steps[i]);
    expect(shown.some((s) => /sign up/i.test(s))).toBe(false);
    expect(shown.length).toBeGreaterThan(0);
    expect(homebase!.account.length).toBeGreaterThan(0);
  });

  it("counts progress per tool and overall, and finds where to continue", () => {
    const { profile, pieces } = demo("coffee");
    const seq = setupSequence(buildPlan(profile, pieces, catalog), profile, catalog);
    const first = seq[0];
    const checks = Object.fromEntries(toolKeys(first).map((k) => [k, true]));
    expect(toolProgress(first, checks)).toEqual({ done: toolKeys(first).length, total: toolKeys(first).length });
    expect(nextUnfinished(seq, checks)?.tool.id).toBe(seq[1].tool.id);
    const all = overallProgress(seq, checks);
    expect(all.done).toBe(toolKeys(first).length);
    expect(percent(all)).toBeGreaterThan(0);
    expect(percent({ done: 0, total: 0 })).toBe(0);
  });
});
