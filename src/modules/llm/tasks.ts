import { z } from "zod";
import { ArchetypeIdSchema } from "@/modules/taxonomy/schemas";

/**
 * Task definitions (SPEC §4). The same Zod schemas validate structured output and
 * generate its JSON schema. The LLM may only rephrase or classify.
 */

export const ClassifyInput = z.object({ description: z.string().min(1).max(500) });
export const ClassifyOutput = z.object({
  archetypes: z.array(ArchetypeIdSchema),
  naics: z.object({ code: z.string(), title: z.string() }),
  confidence: z.number(),
  suggested_extra_blocks: z.array(z.string()),
});

export const MapProblemInput = z.object({
  problem: z.string().min(1).max(500),
  blocks: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        plain_name: z.string(),
        description: z.string(),
      }),
    )
    .max(80),
});
export const MapProblemOutput = z.object({ block_ids: z.array(z.string()), why: z.string() });

export const ExplainInput = z.object({
  tool: z.object({ name: z.string(), ai_capabilities: z.array(z.string()) }),
  verdict: z.object({ state: z.string(), visible: z.string(), reasons: z.array(z.string()) }),
  business: z.object({ archetypes: z.array(z.string()), regulated: z.string() }),
});
export const ExplainOutput = z.object({ sentence: z.string() });

export const PersonalizeInput = z.object({
  tool: z.string(),
  steps: z.array(z.string()).max(12),
  business: z.string().max(500),
});
export const PersonalizeOutput = z.object({ steps: z.array(z.string()) });

export const ExtractInput = z.object({ url: z.string().url(), page_text: z.string().max(40000) });
export const ExtractOutput = z.object({
  name: z.string(),
  vendor_url: z.string(),
  is_ai_tool: z.boolean(),
  ai_capabilities: z.array(z.string()),
  suggested_blocks: z.array(z.string()),
  suggested_archetypes: z.array(z.string()),
  works_with: z.array(z.string()),
  tiers: z.array(z.object({ name: z.string(), monthly_usd: z.number().nullable() })),
  free_tier: z.boolean(),
  evidence: z.array(z.object({ claim: z.string(), quote: z.string() })),
});

export const VerifyEdgeInput = z.object({
  page_text: z.string().max(40000),
  claim: z.object({
    from: z.string(),
    to: z.string(),
    entities: z.array(z.string()),
    direction: z.string(),
  }),
});
export const VerifyEdgeOutput = z.object({
  supported: z.boolean(),
  quote: z.string(),
  direction: z.string().nullable(),
  tier: z.string().nullable(),
});

export type TaskId =
  | "classify_business"
  | "map_problem"
  | "explain_verdict"
  | "personalize_steps"
  | "extract_tool_profile"
  | "verify_edge";

export type TaskDef = {
  model: "fast" | "smart";
  temperature: number;
  input: z.ZodType;
  output: z.ZodType;
};

export const TASKS: Record<TaskId, TaskDef> = {
  classify_business: { model: "fast", temperature: 0, input: ClassifyInput, output: ClassifyOutput },
  map_problem: { model: "fast", temperature: 0, input: MapProblemInput, output: MapProblemOutput },
  explain_verdict: { model: "fast", temperature: 0.2, input: ExplainInput, output: ExplainOutput },
  personalize_steps: { model: "fast", temperature: 0.2, input: PersonalizeInput, output: PersonalizeOutput },
  extract_tool_profile: { model: "smart", temperature: 0, input: ExtractInput, output: ExtractOutput },
  verify_edge: { model: "smart", temperature: 0, input: VerifyEdgeInput, output: VerifyEdgeOutput },
};

/** Tasks the browser may call. Offline tasks never get an API route. */
export const PUBLIC_TASKS = new Set<TaskId>([
  "classify_business",
  "map_problem",
  "explain_verdict",
  "personalize_steps",
]);

function numbersIn(text: string): string[] {
  return text.match(/\d[\d,.]*/g) ?? [];
}

/** True when the output states a number that wasn't in the input: no new prices or facts. */
export function addsNewNumbers(output: string, input: string): boolean {
  const allowed = new Set(numbersIn(input));
  return numbersIn(output).some((n) => !allowed.has(n));
}

/** Rules the schema can't express. A failure is treated like a parse failure. */
export function passesGuards(task: TaskId, input: unknown, output: unknown): boolean {
  if (task === "explain_verdict") {
    const { sentence } = output as z.infer<typeof ExplainOutput>;
    return sentence.trim().length > 0 && !addsNewNumbers(sentence, JSON.stringify(input));
  }
  if (task === "personalize_steps") {
    const inp = input as z.infer<typeof PersonalizeInput>;
    const out = output as z.infer<typeof PersonalizeOutput>;
    return (
      out.steps.length === inp.steps.length &&
      !addsNewNumbers(out.steps.join(" "), JSON.stringify(inp))
    );
  }
  if (task === "map_problem") {
    const inp = input as z.infer<typeof MapProblemInput>;
    const out = output as z.infer<typeof MapProblemOutput>;
    return (
      out.block_ids.length <= 3 && out.block_ids.every((id) => inp.blocks.some((b) => b.id === id))
    );
  }
  if (task === "extract_tool_profile" || task === "verify_edge") {
    const text = (input as { page_text: string }).page_text.toLowerCase().replace(/\s+/g, " ");
    const quotes =
      task === "verify_edge"
        ? [(output as z.infer<typeof VerifyEdgeOutput>).quote].filter(Boolean)
        : (output as z.infer<typeof ExtractOutput>).evidence.map((e) => e.quote);
    return quotes.every((q) => text.includes(q.toLowerCase().replace(/\s+/g, " ").trim()));
  }
  return true;
}
