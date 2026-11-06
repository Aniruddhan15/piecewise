import { evaluate, evaluateSeams, resolveAnchor } from "@/modules/compat-engine/engine";
import { DEFAULT_BUDGET } from "@/modules/fit-score/score";
import { starterBlocks } from "@/modules/matcher/match";
import type {
  BusinessProfile,
  Catalog,
  Reason,
  Seam,
  Tool,
  Verdict,
  VisibleState,
} from "@/modules/taxonomy/types";
import { roundUsd, toolCost, type ToolCost } from "./cost";

/** Adoption plan (M11): pure logic, so it can be tested without a browser. */

export type PlanTool = {
  tool: Tool;
  blockId: string;
  blockName: string;
  verdict: Verdict;
  cost: ToolCost;
};

export type RolloutStep = {
  title: string;
  hours: number;
  toolId?: string;
  why: string;
};

export type OpenIssue = {
  title: string;
  state: VisibleState;
  reason: Reason;
  todo: string;
};

export type Plan = {
  tools: PlanTool[];
  seams: Seam[];
  costLines: { label: string; monthly_usd: number | null; note?: string }[];
  total: number;
  hasUnknownPrice: boolean;
  budget: number;
  overBudget: boolean;
  rollout: RolloutStep[];
  issues: OpenIssue[];
  anyNotAllowed: boolean;
};

const TODO: Record<string, string> = {
  R1: "Stay with your main system's payments. Taking this further means replacing the main system.",
  R2: "Choose a tool that runs on your devices, or budget for the hardware.",
  R3: "Move your books to a supported edition, or choose a tool that supports yours.",
  R4: "Use a payroll tool that posts to your books.",
  R5: "Ask the vendor if they're an approved partner, or choose a listed partner.",
  R6: "Choose a tool that works with your main system.",
  R7: "Choose one of the tools that fit instead.",
  R8: "Remove this tool, or keep all patient data out of it. Ask for a compliant option.",
  R9: "Upgrade before you share patient data.",
  R10: "Turn this feature off for anything touching patient data.",
  R11: "Turn this feature off. Ask every customer for a review, not only happy ones.",
  R12: "Find a replacement. This connection no longer works.",
  R13: "Pick one tool as the source of truth, and only edit records there.",
  R14: "Keep one tool for this job and switch the other off.",
  R15: "Use what you have before paying for something new.",
  R16: "Pick one. They can't run together.",
  R17: "Decide if the upgrade is worth it. If not, enter the data by hand.",
  R18: "Set up the connector, and allow for the delay.",
  R19: "Set up the connector, and allow for the delay.",
  R20: "Do your edits on the sending side, and check the other side weekly.",
  R21: "Ask your bookkeeper how to handle this before you connect them.",
  R22: "Don't rely on this data being up to the minute.",
  R23: "Finish this step before you turn the tool on.",
  R26: "Add this fee to your costs.",
};

const NON_ISSUES = new Set(["OK", "NOTE"]);

export function buildPlan(
  profile: BusinessProfile,
  pieces: Record<string, string>,
  catalog: Catalog,
): Plan {
  const anchor = resolveAnchor(profile, catalog);
  const uniqueTools: Tool[] = [];
  for (const id of new Set(Object.values(pieces))) {
    const t = catalog.byId.get(id);
    if (t) uniqueTools.push(t);
  }

  const tools: PlanTool[] = Object.entries(pieces).flatMap(([blockId, toolId]) => {
    const tool = catalog.byId.get(toolId);
    if (!tool) return [];
    const others = uniqueTools.filter((t) => t.id !== tool.id);
    const verdict = evaluate(tool, profile, others, catalog);
    return [
      {
        tool,
        blockId,
        blockName: catalog.blockById.get(blockId)?.plain_name ?? blockId,
        verdict,
        cost: toolCost(tool, verdict, profile, catalog),
      },
    ];
  });

  const seams = evaluateSeams(profile, uniqueTools, catalog);

  // Cost: new spending only. What you already pay for isn't counted, except upgrades.
  const costLines: Plan["costLines"] = [];
  const seenAdapters = new Set<string>();
  for (const pt of tools) {
    for (const line of pt.cost.lines) {
      if (pt.verdict.adapter && line.label.includes("to link them")) {
        if (seenAdapters.has(pt.verdict.adapter)) continue;
        seenAdapters.add(pt.verdict.adapter);
      }
      costLines.push(line);
    }
  }
  if (anchor) {
    const v = evaluate(anchor, profile, uniqueTools.filter((t) => t.id !== anchor.id), catalog);
    if (v.required_tier && v.extra_monthly_usd > 0) {
      costLines.push({
        label: `Upgrade ${anchor.name} to ${v.required_tier}`,
        monthly_usd: v.extra_monthly_usd,
        note: "needed for a connection",
      });
    }
  }
  const known = costLines.filter((l) => l.monthly_usd !== null);
  const total = roundUsd(known.reduce((sum, l) => sum + (l.monthly_usd ?? 0), 0));
  const budget = profile.monthly_budget_usd ?? DEFAULT_BUDGET;

  // Rollout: fix anchor gaps first, then starter order, then everything else.
  const starters = starterBlocks(profile, catalog);
  const order = (blockId: string) => {
    const i = starters.indexOf(blockId);
    return i === -1 ? starters.length : i;
  };
  const rollout: RolloutStep[] = [];
  if (!anchor) {
    rollout.push({
      title: "Choose your main system",
      hours: 8,
      why: "Everything else has to fit around it, so it comes first.",
    });
  }
  const blockedBase = seams.find(
    (s) => s.visible === "no_fit" && [s.a, s.b].includes(anchor?.id ?? ""),
  );
  if (blockedBase) {
    rollout.push({
      title: "Sort out your main system's connection",
      hours: 4,
      why: blockedBase.reasons[0]?.message ?? "Your main system has a connection that doesn't fit.",
    });
  }
  const placed = [...tools]
    .filter((t) => t.verdict.visible === "fits" || t.verdict.visible === "catch")
    .sort((a, b) => order(a.blockId) - order(b.blockId));
  const anchorFirst = (t: PlanTool) => (t.tool.kind === "base_system" ? 0 : 1);
  placed.sort((a, b) => anchorFirst(a) - anchorFirst(b) || order(a.blockId) - order(b.blockId));
  for (const pt of placed) {
    rollout.push({
      title: `Set up ${pt.tool.name}`,
      hours: pt.tool.setup.hours_estimate,
      toolId: pt.tool.id,
      why:
        order(pt.blockId) < starters.length
          ? `A "start here" piece for your kind of business: ${pt.blockName.toLowerCase()}.`
          : `Fills your "${pt.blockName.toLowerCase()}" piece.`,
    });
  }

  // Open issues: every catch, overlap and block, with what to do about it.
  const issues: OpenIssue[] = [];
  const seen = new Set<string>();
  const addIssue = (title: string, state: VisibleState, reason: Reason) => {
    if (NON_ISSUES.has(reason.rule)) return;
    if (reason.rule === "R7" && state === "fits") return;
    const key = `${reason.rule}|${reason.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ title, state, reason, todo: TODO[reason.rule] ?? "Check this before you buy." });
  };
  for (const pt of tools) {
    for (const r of pt.verdict.reasons) addIssue(pt.tool.name, pt.verdict.visible, r);
  }
  for (const s of seams) {
    const a = catalog.byId.get(s.a)?.name ?? s.a;
    const b = catalog.byId.get(s.b)?.name ?? s.b;
    for (const r of s.reasons) addIssue(`${a} and ${b}`, s.visible, r);
  }
  const rank: Record<VisibleState, number> = { not_allowed: 0, no_fit: 1, catch: 2, fits: 3 };
  issues.sort((a, b) => rank[a.state] - rank[b.state]);

  return {
    tools,
    seams,
    costLines,
    total,
    hasUnknownPrice: known.length !== costLines.length,
    budget,
    overBudget: total > budget,
    rollout,
    issues,
    anyNotAllowed: tools.some((t) => t.verdict.visible === "not_allowed") ||
      seams.some((s) => s.visible === "not_allowed"),
  };
}
