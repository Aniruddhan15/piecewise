/**
 * Pre-generates LLM outputs for the demo businesses (M15.F2, M17.F3), so demos load with
 * no live call. Run with `npm run pregen` once OPENROUTER_API_KEY is set.
 * Outputs go to data/cache/llm.json, keyed by a hash of (task, input).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { evaluate } from "../src/modules/compat-engine/engine";
import { cacheKey, configFromEnv, createGateway } from "../src/modules/llm/gateway";
import { explainPayload, mapProblemPayload, personalizePayload } from "../src/modules/llm/payloads";
import type { TaskId } from "../src/modules/llm/tasks";
import { blocksForProfile, matchBlock, starterBlocks } from "../src/modules/matcher/match";
import { catalog, demos } from "../src/modules/taxonomy/catalog";
import type { Tool } from "../src/modules/taxonomy/types";

for (const line of (() => {
  try {
    return readFileSync(".env.local", "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
})()) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const CACHE_PATH = "data/cache/llm.json";
const config = configFromEnv();
if (!config.enabled) {
  console.error("OPENROUTER_API_KEY isn't set, or LLM_ENABLED=false. Nothing to do.");
  process.exit(1);
}

const cache: Record<string, unknown> = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
const gateway = createGateway({ config, precomputed: {} });

const CLASSIFY = [
  "A family restaurant with 12 staff",
  "A neighborhood coffee shop with 5 staff",
  "A two-truck HVAC company",
  "A landscaping company with a crew of 6",
  "bakery that also sells coffee beans",
  ...demos.map((d) => d.profile.description),
];
const HEADACHES = [
  "I keep missing calls while I'm on a job",
  "Food costs keep eating my margins",
  "Patients don't show up for their appointments",
];

let made = 0;
let reused = 0;
let failed = 0;

async function run(task: TaskId, input: unknown) {
  const key = cacheKey(task, input);
  if (key in cache) {
    reused += 1;
    return;
  }
  const out = await gateway.call(task, input, { skipLimits: true });
  if (out === null) {
    failed += 1;
    console.warn(`  failed: ${task}`);
    return;
  }
  cache[key] = out;
  made += 1;
}

for (const text of CLASSIFY) await run("classify_business", { description: text });

for (const demo of demos) {
  console.log(`Demo: ${demo.label}`);
  const chosen = Object.values(demo.pieces)
    .map((id) => catalog.byId.get(id))
    .filter((t): t is Tool => Boolean(t));
  const blocks = blocksForProfile(demo.profile, catalog);
  const blockIds = new Set([...Object.keys(demo.pieces), ...starterBlocks(demo.profile, catalog)]);

  for (const id of blockIds) {
    const block = catalog.blockById.get(id);
    if (!block) continue;
    const r = matchBlock(block, demo.profile, chosen, catalog);
    for (const m of [...r.fits, ...r.catches]) {
      await run("explain_verdict", explainPayload(m.tool, m.verdict, demo.profile));
    }
  }
  for (const tool of chosen) {
    const verdict = evaluate(tool, demo.profile, chosen.filter((t) => t.id !== tool.id), catalog);
    await run("explain_verdict", explainPayload(tool, verdict, demo.profile));
    await run("personalize_steps", personalizePayload(tool, demo.profile.description));
  }
  for (const h of HEADACHES) await run("map_problem", mapProblemPayload(h, blocks));
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
}

console.log(`Done: ${made} new, ${reused} already cached, ${failed} failed.`);
