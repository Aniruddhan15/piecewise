import type { Block, BusinessProfile, Tool, Verdict } from "@/modules/taxonomy/types";

/**
 * Request bodies shared by the browser and the pregeneration script. The cache is keyed by
 * a hash of the input, so both must build exactly the same object.
 */

export function explainPayload(tool: Tool, verdict: Verdict, profile: BusinessProfile) {
  return {
    tool: { name: tool.name, ai_capabilities: tool.ai_capabilities },
    verdict: {
      state: verdict.state,
      visible: verdict.visible,
      reasons: verdict.reasons.map((r) => r.message),
    },
    business: { archetypes: profile.archetypes, regulated: profile.regulated },
  };
}

export function personalizePayload(tool: Tool, description: string) {
  return { tool: tool.name, steps: tool.setup.steps, business: description };
}

export function mapProblemPayload(problem: string, blocks: Block[]) {
  return {
    problem,
    blocks: blocks.map((b) => ({
      id: b.id,
      name: b.name,
      plain_name: b.plain_name,
      description: b.description,
    })),
  };
}
