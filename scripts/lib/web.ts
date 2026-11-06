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

/** The Disallow prefixes that apply to us: our own group if named, else the "*" group. */
export function parseRobots(text: string): string[] {
  const groups = new Map<string, string[]>();
  let agents: string[] = [];
  let collecting = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const match = line.match(/^(user-agent|disallow):\s*(.*)$/i);
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
        if (value) rules.push(value);
        groups.set(a, rules);
      }
    }
  }
  return groups.get("piecewisecatalogbot") ?? groups.get("*") ?? [];
}

export function robotsAllow(rules: string[], path: string): boolean {
  return !rules.some((rule) => path.startsWith(rule.replace(/\*.*$/, "")));
}

const robotsCache = new Map<string, string[]>();

export async function allowedByRobots(url: string): Promise<boolean> {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    try {
      const { status, html } = await fetchPage(`${origin}/robots.txt`, 10_000);
      robotsCache.set(origin, status === 200 ? parseRobots(html) : []);
    } catch {
      // If we can't read the rules, we don't assume we're allowed.
      robotsCache.set(origin, ["/"]);
    }
  }
  return robotsAllow(robotsCache.get(origin) ?? [], pathname);
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
