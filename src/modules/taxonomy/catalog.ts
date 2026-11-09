import { z } from "zod";
import archetypesJson from "@data/archetypes.json";
import baseSystemsJson from "@data/base_systems.json";
import blocksJson from "@data/blocks.json";
import demoProfilesJson from "@data/demo_profiles.json";
import edgesJson from "@data/edges.json";
import naicsJson from "@data/naics_map.json";
import impactJson from "@data/impact.json";
import outcomesJson from "@data/outcomes.json";
import sbaJson from "@data/sba_resources.json";
import toolsJson from "@data/tools.json";
import {
  ArchetypeSchema,
  BlockSchema,
  DemoProfileSchema,
  EdgeSchema,
  ImpactSchema,
  NaicsMapSchema,
  OutcomeSchema,
  SbaResourceSchema,
  ToolSchema,
} from "./schemas";
import type { ArchetypeId, Catalog, DemoProfile, Edge, Tool } from "./types";

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Builds the in-memory indexes (M1.F5) from already-validated data. */
export function buildCatalog(input: {
  tools: Tool[];
  edges: Edge[];
  blocks: Catalog["blocks"];
  archetypes: Catalog["archetypes"];
  sba: Catalog["sba"];
}): Catalog {
  const byId = new Map(input.tools.map((t) => [t.id, t]));
  const edgesByTool = new Map<string, Edge[]>();
  for (const e of input.edges) {
    pushTo(edgesByTool, e.from, e);
    pushTo(edgesByTool, e.to, e);
  }
  const toolsByBlock = new Map<string, Tool[]>();
  for (const t of input.tools) for (const b of t.blocks) pushTo(toolsByBlock, b, t);
  return {
    ...input,
    byId,
    edgesByTool,
    toolsByBlock,
    blockById: new Map(input.blocks.map((b) => [b.id, b])),
    archetypeById: new Map(input.archetypes.map((a) => [a.id as ArchetypeId, a])),
  };
}

export const rawData = {
  tools: z.array(ToolSchema).parse([...baseSystemsJson, ...toolsJson]),
  edges: z.array(EdgeSchema).parse(edgesJson),
  blocks: z.array(BlockSchema).parse(blocksJson),
  archetypes: z.array(ArchetypeSchema).parse(archetypesJson),
  sba: z.array(SbaResourceSchema).parse(sbaJson),
  demos: z.array(DemoProfileSchema).parse(demoProfilesJson) as DemoProfile[],
  naics: NaicsMapSchema.parse(naicsJson),
  outcomes: z.array(OutcomeSchema).parse(outcomesJson),
  impact: z.array(ImpactSchema).parse(impactJson),
};

export const catalog: Catalog = buildCatalog(rawData);
export const demos = rawData.demos;
export const naicsMap = rawData.naics;
