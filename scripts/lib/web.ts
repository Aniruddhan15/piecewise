/** Polite fetching for the offline scripts: generic user agent, robots.txt, delays. */

const USER_AGENT = "PieceWiseCatalogBot/0.1 (small business tool directory research)";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchPage(url: string, timeoutMs = 20_000): Promise<{ status: number; html: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, html: await res.text() };
}

export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export type RobotsRule = { allow: boolean; path: string };

/** The rules that apply to us: our own group if named, else the "*" group. */
export function parseRobots(text: string): RobotsRule[] {
  const groups = new Map<string, RobotsRule[]>();
  let agents: string[] = [];
  let collecting = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const match = line.match(/^(user-agent|disallow|allow):\s*(.*)$/i);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (collecting) agents = [];
      collecting = false;
      agents.push(value.toLowerCase());
    } else {
      collecting = true;
      for (const a of agents) {
        const rules = groups.get(a) ?? [];
        if (value) rules.push({ allow: field === "allow", path: value });
        groups.set(a, rules);
      }
    }
  }
  return groups.get("piecewisecatalogbot") ?? groups.get("*") ?? [];
}

function ruleRegex(path: string): RegExp {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Standard matching: wildcards are honored, and the longest matching rule wins. */
export function robotsAllow(rules: RobotsRule[], path: string): boolean {
  let best: RobotsRule | undefined;
  for (const rule of rules) {
    if (!ruleRegex(rule.path).test(path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

const robotsCache = new Map<string, RobotsRule[]>();

export async function allowedByRobots(url: string): Promise<boolean> {
  const { origin, pathname, search } = new URL(url);
  if (!robotsCache.has(origin)) {
    try {
      const { status, html } = await fetchPage(`${origin}/robots.txt`, 10_000);
      robotsCache.set(origin, status === 200 ? parseRobots(html) : []);
    } catch {
      // If we can't read the rules, we don't assume we're allowed.
      robotsCache.set(origin, [{ allow: false, path: "/" }]);
    }
  }
  return robotsAllow(robotsCache.get(origin) ?? [], `${pathname}${search}`);
}

export function loadEnvLocal(readFile: (path: string) => string) {
  let text = "";
  try {
    text = readFile(".env.local");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
