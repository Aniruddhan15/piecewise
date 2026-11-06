/**
 * Discovery agent (M13). AI tools have to be found by the platform, not submitted to it.
 *
 *   npm run discover -- --source xero --max 5
 *   npm run discover -- --urls https://vendor.example/pricing,https://vendor.example/ai
 *   npm run discover -- --source xero --dry-run      (lists pages; no LLM calls)
 *
 * Fetches each page, extracts readable text, asks the LLM for a partial tool profile with
 * exact quotes, validates it, and writes it to data/candidates/. Candidates never reach the
 * live catalog on their own: every one stays verified:false until a person approves it.
 *
 * Respects robots.txt, waits between requests, uses a generic user agent, caps pages per run.
 *
 * Check a marketplace's terms before adding it as a source. The Shopify App Store allows this
 * in robots.txt, but Shopify's terms bar automated access, so it isn't configured here.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createGateway, configFromEnv } from "../src/modules/llm/gateway";
import type { ExtractOutput } from "../src/modules/llm/tasks";
import { catalog } from "../src/modules/taxonomy/catalog";
import type { z } from "zod";
import { allowedByRobots, fetchPage, loadEnvLocal, pageText, sleep } from "./lib/web";

type Source = {
  name: string;
  listing_urls: string[];
  app_link_pattern: string;
  base_url: string;
  evidence_grade: number;
  edge_to?: string;
};

const HARD_CAP = 25;
const DELAY_MS = 2000;
const OUT_DIR = "data/candidates";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const dryRun = process.argv.includes("--dry-run");
const max = Math.min(Number(arg("max")) || 5, HARD_CAP);

loadEnvLocal((p) => readFileSync(p, "utf8"));
const config = configFromEnv();
if (!config.enabled && !dryRun) {
  console.error("OPENROUTER_API_KEY isn't set, or LLM_ENABLED=false. Use --dry-run to list pages only.");
  process.exit(1);
}
const gateway = createGateway({ config, precomputed: {} });

const log = (msg: string) => console.log(msg);
const slugOf = (url: string) =>
  new URL(url).pathname.split("/").filter(Boolean).pop() ?? new URL(url).hostname;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const known = new Set(catalog.tools.flatMap((t) => [norm(t.name), norm(t.id)]));
const knownDomains = new Set(catalog.tools.map((t) => new URL(t.vendor_url).hostname.replace(/^www\./, "")));

async function listFromSource(source: Source): Promise<string[]> {
  const pages = new Set<string>();
  const pattern = new RegExp(source.app_link_pattern, "g");
  for (const listing of source.listing_urls) {
    if (!(await allowedByRobots(listing))) {
      log(`  robots.txt blocks ${listing}, skipping`);
      continue;
    }
    log(`Reading listing: ${listing}`);
    const { status, html } = await fetchPage(listing);
    if (status !== 200) {
      log(`  got ${status}, skipping`);
      continue;
    }
    for (const m of html.matchAll(pattern)) pages.add(new URL(m[1], source.base_url).href);
    await sleep(DELAY_MS);
  }
  return [...pages];
}

const sourceId = arg("source") ?? "xero";
const urlsArg = arg("urls");
const sources: Record<string, Source> = JSON.parse(readFileSync("data/discovery_sources.json", "utf8"));
const source = urlsArg ? undefined : sources[sourceId];
if (!urlsArg && !source) {
  console.error(`Unknown source "${sourceId}". Known: ${Object.keys(sources).join(", ")}`);
  process.exit(1);
}

const found = urlsArg ? urlsArg.split(",") : await listFromSource(source as Source);
const fresh = found.filter((url) => !known.has(norm(slugOf(url))));
log(`Found ${found.length} listings, ${found.length - fresh.length} already in our catalog.`);
const todo = fresh.slice(0, max);
log(`Reading ${todo.length} (cap for this run: ${max}).\n`);

if (dryRun) {
  for (const url of todo) log(`  would read ${url}`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const validBlocks = new Set(catalog.blocks.map((b) => b.id));
const validArchetypes = new Set<string>(catalog.archetypes.map((a) => a.id));
const results = { written: 0, notAi: 0, skipped: 0, known: 0 };

for (const url of todo) {
  const slug = slugOf(url);
  const path = `${OUT_DIR}/${slug}.json`;
  if (existsSync(path)) {
    log(`- ${slug}: already a candidate`);
    results.skipped += 1;
    continue;
  }
  if (!(await allowedByRobots(url))) {
    log(`- ${slug}: robots.txt blocks this page, skipping`);
    results.skipped += 1;
    continue;
  }
  try {
    const { status, html } = await fetchPage(url);
    if (status !== 200) {
      log(`- ${slug}: got ${status}, skipping`);
      results.skipped += 1;
      continue;
    }
    const profile = await gateway.call<z.infer<typeof ExtractOutput>>(
      "extract_tool_profile",
      { url, page_text: pageText(html).slice(0, 30_000) },
      { skipLimits: true },
    );
    if (!profile) {
      // SPEC §4: skip the tool and log it for manual review.
      log(`- ${slug}: couldn't extract a validated profile, logged for manual review`);
      results.skipped += 1;
      continue;
    }
    let domain = "";
    try {
      domain = new URL(profile.vendor_url).hostname.replace(/^www\./, "");
    } catch {
      // The listing page doesn't state a vendor site; keep the listing URL only.
    }
    if (known.has(norm(profile.name)) || (domain && knownDomains.has(domain))) {
      log(`- ${profile.name}: already in our catalog`);
      results.known += 1;
    } else if (!profile.is_ai_tool || profile.ai_capabilities.length === 0) {
      log(`- ${profile.name}: no specific AI capability on the page, not a candidate`);
      results.notAi += 1;
    } else {
      const candidate = {
        id: slug.replace(/-/g, "_"),
        ...profile,
        suggested_blocks: profile.suggested_blocks.filter((b) => validBlocks.has(b)),
        suggested_archetypes: profile.suggested_archetypes.filter((a) => validArchetypes.has(a)),
        kind: "ai_tool",
        source_url: url,
        source: source?.name ?? "manual URL list",
        evidence: profile.evidence.map((e) => ({
          ...e,
          url,
          grade: source?.evidence_grade ?? 3,
        })),
        proposed_edges: source?.edge_to
          ? [{ from: slug.replace(/-/g, "_"), to: source.edge_to, type: "certified", evidence_url: url }]
          : [],
        discovered_at: new Date().toISOString().slice(0, 10),
        verified: false,
      };
      writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`);
      log(`+ NEW candidate: ${profile.name}`);
      for (const c of profile.ai_capabilities) log(`    AI: ${c}`);
      for (const e of profile.evidence.slice(0, 2)) log(`    quote: "${e.quote}"`);
      results.written += 1;
    }
  } catch (err) {
    log(`- ${slug}: fetch failed (${(err as Error).name}), skipping`);
    results.skipped += 1;
  }
  await sleep(DELAY_MS);
}

log(
  `\nDone: ${results.written} new candidates in ${OUT_DIR}/ (all verified:false), ` +
    `${results.notAi} without clear AI, ${results.known} already known, ${results.skipped} skipped.`,
);
