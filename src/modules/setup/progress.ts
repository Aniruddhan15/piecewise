import { resolveAnchor } from "@/modules/compat-engine/engine";
import type { Plan } from "@/modules/plan/build-plan";
import type { BusinessProfile, Catalog, Tool } from "@/modules/taxonomy/types";
import { accountSteps } from "@/modules/tool-start/summary";

/**
 * Setup sequence (M14): the plan's tools in the order to set them up, each with two parts,
 * "create your account" and "set it up". Checkmarks are stored by key, so progress is
 * the same on the setup page, the dashboard and any device the owner signs in on.
 */

export type SetupTool = {
  tool: Tool;
  /** Every job this tool fills, in plain words. */
  jobs: string[];
  hours: number;
  account: string[];
  /**
   * Which catalog setup steps to show, by index. Steps that only repeat "sign up" or "start
   * a trial" are left out, because part 1 already covers creating the account.
   */
  setupIdx: number[];
};

const ACCOUNT_STEP = /^(sign up|create (a |an |your )?(free )?account|start (a |the |your )?(\d+-day )?(free )?trial|start free|begin (a |the )?(free )?(trial|plan)|book a demo|request a demo)/i;

export type Progress = { done: number; total: number };

export const accountKey = (toolId: string, i: number) => `${toolId}:acct:${i}`;
export const setupKey = (toolId: string, i: number) => `${toolId}:${i}`;

export function setupSequence(plan: Plan, profile: BusinessProfile, catalog: Catalog): SetupTool[] {
  const anchorName = resolveAnchor(profile, catalog)?.name;
  const result: SetupTool[] = [];
  for (const step of plan.rollout) {
    if (!step.toolId) continue;
    const entries = plan.usable.filter((u) => u.tool.id === step.toolId);
    const first = entries[0];
    if (!first) continue;
    result.push({
      tool: first.tool,
      jobs: entries.map((e) => e.blockName),
      hours: first.tool.setup.hours_estimate,
      account: accountSteps(first.tool, { anchorName, tier: first.cost.tier, jobName: first.blockName }),
      setupIdx: first.tool.setup.steps.map((_, i) => i).filter((i) => !ACCOUNT_STEP.test(first.tool.setup.steps[i].trim())),
    });
  }
  return result;
}

export function toolKeys(t: SetupTool): string[] {
  return [
    ...t.account.map((_, i) => accountKey(t.tool.id, i)),
    ...t.setupIdx.map((i) => setupKey(t.tool.id, i)),
  ];
}

export function toolProgress(t: SetupTool, checks: Record<string, boolean>): Progress {
  const keys = toolKeys(t);
  return { done: keys.filter((k) => checks[k]).length, total: keys.length };
}

export function overallProgress(seq: SetupTool[], checks: Record<string, boolean>): Progress {
  return seq.reduce(
    (sum, t) => {
      const p = toolProgress(t, checks);
      return { done: sum.done + p.done, total: sum.total + p.total };
    },
    { done: 0, total: 0 },
  );
}

/** The first tool that isn't finished yet, for "Continue setup". */
export function nextUnfinished(seq: SetupTool[], checks: Record<string, boolean>): SetupTool | undefined {
  return seq.find((t) => {
    const p = toolProgress(t, checks);
    return p.done < p.total;
  });
}

export const percent = (p: Progress) => (p.total === 0 ? 0 : Math.round((p.done / p.total) * 100));
