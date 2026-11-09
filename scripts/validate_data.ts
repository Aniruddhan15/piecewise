/**
 * Fails the build on invalid seed data (M1.F1, M1.F4).
 * Run with `npm run validate`; it also runs automatically before `next build`.
 */
import { rawData } from "../src/modules/taxonomy/catalog";

const errors: string[] = [];
const { tools, edges, blocks, archetypes, demos, sba } = rawData;
const toolIds = new Set(tools.map((t) => t.id));
const blockIds = new Set(blocks.map((b) => b.id));

const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
for (const d of dupes(tools.map((t) => t.id))) errors.push(`duplicate tool id: ${d}`);
for (const d of dupes(blocks.map((b) => b.id))) errors.push(`duplicate block id: ${d}`);

for (const t of tools) {
  if (t.kind === "ai_tool" && t.ai_capabilities.length === 0)
    errors.push(`${t.id}: ai_tool needs at least 1 ai_capabilities entry`);
  if (t.evidence.length === 0) errors.push(`${t.id}: no evidence`);
  if (t.kind === "ai_tool" && !t.needs && !t.standalone_ok)
    errors.push(`${t.id}: ai_tool needs "needs" or "standalone_ok" so R7 can be evaluated`);
  for (const b of t.blocks) if (!blockIds.has(b)) errors.push(`${t.id}: unknown block ${b}`);
  for (const c of t.covers ?? [])
    if (!blockIds.has(c.block)) errors.push(`${t.id}: covers unknown block ${c.block}`);
  for (const i of t.included_in ?? [])
    if (!toolIds.has(i.base_system)) errors.push(`${t.id}: included_in unknown ${i.base_system}`);
  if (t.ecosystem_lock && !toolIds.has(t.ecosystem_lock))
    errors.push(`${t.id}: ecosystem_lock unknown ${t.ecosystem_lock}`);
  if (t.evidence.some((e) => (e.quote?.split(/\s+/).length ?? 0) > 15))
    errors.push(`${t.id}: evidence quote over 15 words`);
  if (!t.verified && t.evidence.length === 0)
    errors.push(`${t.id}: unverified tool still needs a source`);
}

for (const e of edges) {
  const label = `${e.from} -> ${e.to}`;
  if (!toolIds.has(e.from)) errors.push(`edge ${label}: unknown from`);
  if (!toolIds.has(e.to)) errors.push(`edge ${label}: unknown to`);
  if ((e.type === "ipaas" || e.type === "bridge_app") && !e.via)
    errors.push(`edge ${label}: ${e.type} edge needs "via"`);
  if (e.via && !toolIds.has(e.via)) errors.push(`edge ${label}: unknown via ${e.via}`);
  if ((e.evidence_quote?.split(/\s+/).length ?? 0) > 15)
    errors.push(`edge ${label}: quote over 15 words`);
}

for (const a of archetypes) {
  for (const b of [...a.block_ids, ...a.starter_blocks])
    if (!blockIds.has(b)) errors.push(`archetype ${a.id}: unknown block ${b}`);
}

for (const d of demos) {
  if (d.profile.anchor && !toolIds.has(d.profile.anchor))
    errors.push(`demo ${d.id}: unknown anchor`);
  for (const [block, tool] of Object.entries(d.pieces)) {
    if (!blockIds.has(block)) errors.push(`demo ${d.id}: unknown block ${block}`);
    if (!toolIds.has(tool)) errors.push(`demo ${d.id}: unknown tool ${tool}`);
  }
}

// Every job needs a complete before/after story, and overrides must point at real things.
const archetypeIds = new Set(archetypes.map((a) => a.id));
for (const b of blocks) {
  const base = rawData.outcomes.find((o) => o.block === b.id && !o.archetype);
  if (!base) errors.push(`outcomes: no default story for block ${b.id}`);
  else if (!base.hours || !base.assumption || !base.icon)
    errors.push(`outcomes: default for ${b.id} needs hours, assumption and icon`);
  else if (base.hours[0] > base.hours[1]) errors.push(`outcomes: ${b.id} hours low is above high`);
}
for (const b of blocks) {
  const i = rawData.impact.find((x) => x.block === b.id);
  if (!i) errors.push(`impact: no money and efficiency entry for block ${b.id}`);
  else {
    for (const m of [i.money, ...Object.values(i.by_archetype ?? {}).map((x) => x?.money)]) {
      if (m && m.low > m.high) errors.push(`impact: ${b.id} money low is above high`);
    }
    // A number may only claim to be sourced (or a vendor claim) if it links to where it came from.
    const labeled = [
      { what: "measure", c: i.measure.confidence, src: i.measure.source },
      ...[i.money, ...Object.values(i.by_archetype ?? {}).map((x) => x?.money)]
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({ what: "money", c: m.confidence, src: m.source })),
    ];
    for (const l of labeled) {
      if (l.c !== "guess" && !l.src) errors.push(`impact: ${b.id} ${l.what} is labeled ${l.c} but has no source`);
      if (l.c === "guess" && l.src) errors.push(`impact: ${b.id} ${l.what} has a source but is labeled a guess`);
      if (l.src && !l.src.url.startsWith("https://")) errors.push(`impact: ${b.id} ${l.what} source must be an https link`);
    }
    for (const a of Object.keys(i.by_archetype ?? {}))
      if (!archetypeIds.has(a as never)) errors.push(`impact: ${b.id} unknown archetype ${a}`);
    if (i.measure.better === "higher" && i.measure.after <= i.measure.before)
      errors.push(`impact: ${b.id} measure says higher is better but it doesn't go up`);
    if (i.measure.better === "lower" && i.measure.after >= i.measure.before)
      errors.push(`impact: ${b.id} measure says lower is better but it doesn't go down`);
    if (i.measure.unit === "%" && (i.measure.before > 100 || i.measure.after > 100))
      errors.push(`impact: ${b.id} measure is over 100%`);
  }
}
for (const i of rawData.impact) if (!blockIds.has(i.block)) errors.push(`impact: unknown block ${i.block}`);
for (const o of rawData.outcomes) {
  if (!blockIds.has(o.block)) errors.push(`outcomes: unknown block ${o.block}`);
  if (o.archetype && !archetypeIds.has(o.archetype)) errors.push(`outcomes: unknown archetype ${o.archetype}`);
}

const verifiedEdges = edges.filter((e) => e.verified && e.type !== "none").length;
const realTools = tools.length;
console.log(
  `Catalog: ${realTools} tools (${tools.filter((t) => t.kind === "ai_tool").length} AI, ` +
    `${tools.filter((t) => t.verified).length} verified), ` +
    `${edges.length} edges (${verifiedEdges} verified), ${blocks.length} blocks, ` +
    `${archetypes.length} archetypes, ${demos.length} demos, ${sba.length} SBA resources`,
);

if (errors.length > 0) {
  console.error(`\nData validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("Data validation passed.");
