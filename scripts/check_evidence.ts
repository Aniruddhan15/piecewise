/**
 * Evidence and freshness checker (M14.F1). Integrations decay, so this re-fetches every
 * evidence URL and reports anything that looks gone. Run with `npm run check:evidence`.
 *
 * Report only: a person decides whether to mark an edge deprecated. Hosts whose terms bar
 * automated access, or that block bots, are listed as "check by hand" instead of fetched.
 */
import { rawData } from "../src/modules/taxonomy/catalog";
import { allowedByRobots, fetchPage, sleep } from "./lib/web";

const NO_AUTOMATED_ACCESS = ["shopify.com", "apps.shopify.com", "help.shopify.com"];
const GONE_WORDS = /app (is )?(no longer )?unavailable|no longer available|page not found|has been retired/i;

const urls = new Map<string, string[]>();
const add = (url: string, what: string) => urls.set(url, [...(urls.get(url) ?? []), what]);
for (const t of rawData.tools) for (const e of t.evidence) add(e.url, t.id);
for (const e of rawData.edges) add(e.evidence_url, `${e.from}>${e.to}`);
for (const s of rawData.sba) add(s.url, `sba:${s.id}`);

const byHand: string[] = [];
const blocked: string[] = [];
const gone: string[] = [];
let ok = 0;

for (const [url, used] of urls) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (NO_AUTOMATED_ACCESS.some((h) => host === h || host.endsWith(`.${h}`))) {
    byHand.push(url);
    continue;
  }
  if (!(await allowedByRobots(url))) {
    byHand.push(url);
    continue;
  }
  try {
    const { status, html } = await fetchPage(url);
    if (status === 404 || status === 410 || (status === 200 && GONE_WORDS.test(html.slice(0, 20000)))) {
      gone.push(`${url} (${status}) used by ${used.join(", ")}`);
    } else if (status >= 400) {
      blocked.push(`${url} (${status})`);
    } else {
      ok += 1;
    }
  } catch (err) {
    blocked.push(`${url} (${(err as Error).name})`);
  }
  await sleep(500);
}

console.log(`Checked ${urls.size} URLs: ${ok} fine.`);
if (gone.length) console.log(`\nLooks gone, review these edges:\n  ${gone.join("\n  ")}`);
if (blocked.length) console.log(`\nCouldn't read (often bot blocking), check by hand:\n  ${blocked.join("\n  ")}`);
if (byHand.length) console.log(`\nNot fetched automatically, check by hand:\n  ${byHand.join("\n  ")}`);
