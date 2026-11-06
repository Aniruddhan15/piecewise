import type {
  Badge,
  BusinessProfile,
  Catalog,
  Edge,
  Entity,
  InternalState,
  Need,
  Reason,
  ReasonIcon,
  Seam,
  Tool,
  Verdict,
  VisibleState,
} from "@/modules/taxonomy/types";

/**
 * Compatibility engine (M8). Pure functions only: no I/O and no LLM.
 *
 * Rules run in the order the spec gives. The first blocking rule wins. Every
 * other rule stacks its reason, and the "most serious" stacked state becomes the
 * verdict's state.
 */

export const VISIBLE: Record<InternalState, VisibleState> = {
  snaps: "fits",
  snaps_adapter: "catch",
  snaps_caveat: "catch",
  snaps_cost: "catch",
  needs_upgrade: "catch",
  overlaps: "catch",
  doesnt_fit: "no_fit",
  was_compatible: "no_fit",
  not_allowed: "not_allowed",
};

/** Higher wins when non-blocking rules stack. */
const STACK_RANK: Partial<Record<InternalState, number>> = {
  snaps: 0,
  snaps_caveat: 1,
  snaps_cost: 2,
  snaps_adapter: 3,
  needs_upgrade: 4,
  overlaps: 5,
};

const REAL_LEDGERS = new Set(["qbo", "qbd", "xero", "wave", "freshbooks"]);
const FAST_ENTITIES: Entity[] = ["items", "appointments"];
const LAG_TOLERANCE_MINUTES = 10;

type Hit = {
  rule: string;
  state: InternalState;
  blocking?: boolean;
  message: string;
  evidence_url?: string;
  icon?: ReasonIcon;
  unverified?: boolean;
  badge?: Badge;
  adapter?: string;
  extra_monthly_usd?: number;
  required_tier?: string;
  hidden?: boolean;
};

// ---------- Profile helpers ----------

export function resolveAnchor(profile: BusinessProfile, catalog: Catalog): Tool | undefined {
  if (profile.anchor) return catalog.byId.get(profile.anchor);
  const candidates = [profile.base.customer_records, profile.base.payments_pos]
    .map((id) => (id ? catalog.byId.get(id) : undefined))
    .filter((t): t is Tool => Boolean(t));
  for (const archetype of profile.archetypes) {
    const match = candidates.find((t) => t.anchor_for?.includes(archetype));
    if (match) return match;
  }
  return undefined;
}

/** Every system the business already runs, anchor first. */
export function baseSystems(profile: BusinessProfile, catalog: Catalog): Tool[] {
  const ids = [
    resolveAnchor(profile, catalog)?.id,
    profile.base.payments_pos,
    profile.base.customer_records,
    profile.base.accounting,
  ];
  const seen = new Set<string>();
  const result: Tool[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    const tool = catalog.byId.get(id);
    if (tool) {
      seen.add(id);
      result.push(tool);
    }
  }
  return result;
}

function counterpartFor(
  need: Need,
  profile: BusinessProfile,
  catalog: Catalog,
): Tool | undefined {
  if (need.with === "anchor") return resolveAnchor(profile, catalog);
  if (need.with === "accounting")
    return profile.base.accounting ? catalog.byId.get(profile.base.accounting) : undefined;
  return profile.base.payments_pos ? catalog.byId.get(profile.base.payments_pos) : undefined;
}

export function edgesBetween(a: string, b: string, catalog: Catalog): Edge[] {
  return (catalog.edgesByTool.get(a) ?? []).filter(
    (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a),
  );
}

export function tierRank(tool: Tool, tierName: string | undefined): number {
  if (!tierName) return -1;
  return tool.tiers.findIndex((t) => t.name === tierName);
}

function ownedTierName(tool: Tool, profile: BusinessProfile): string | undefined {
  return profile.selected_tiers[tool.id];
}

function evidenceFor(tool: Tool, rule: string): string | undefined {
  return tool.evidence.find((e) => e.rule === rule)?.url ?? tool.evidence[0]?.url;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const ENTITY_WORD: Record<Entity, string> = {
  customers: "customers",
  items: "products",
  appointments: "appointments",
  invoices: "invoices",
  orders: "sales",
  rates: "prices",
  timesheets: "timesheets",
};

// ---------- Rules on a single tool ----------

function toolRules(tool: Tool, profile: BusinessProfile, catalog: Catalog): Hit[] {
  const hits: Hit[] = [];
  const anchor = resolveAnchor(profile, catalog);

  // R6 Ecosystem-only: the tool only exists inside a platform this business doesn't run.
  if (tool.ecosystem_lock) {
    const running = baseSystems(profile, catalog).map((t) => t.id);
    if (!running.includes(tool.ecosystem_lock)) {
      const owner = catalog.byId.get(tool.ecosystem_lock)?.name ?? tool.ecosystem_lock;
      hits.push({
        rule: "R6",
        state: "doesnt_fit",
        blocking: true,
        hidden: true,
        message: `${tool.name} only works inside ${owner}, which you don't use.`,
        evidence_url: evidenceFor(tool, "R6"),
        icon: "lock",
      });
    }
  }

  // R2 Hardware or OS lock.
  if (tool.id !== anchor?.id && profile.devices.length > 0) {
    if (tool.requires_vendor_hardware) {
      hits.push({
        rule: "R2",
        state: "doesnt_fit",
        blocking: true,
        message: `${tool.name} needs its own hardware, so it won't run on the devices you have.`,
        evidence_url: evidenceFor(tool, "R2"),
        icon: "wrench",
      });
    } else if (
      tool.os_supported &&
      !profile.devices.some((d) => tool.os_supported?.includes(d))
    ) {
      hits.push({
        rule: "R2",
        state: "doesnt_fit",
        blocking: true,
        message: `${tool.name} doesn't run on your devices.`,
        evidence_url: evidenceFor(tool, "R2"),
        icon: "wrench",
      });
    }
  }

  return hits;
}

function complianceRules(tool: Tool, profile: BusinessProfile): Hit[] {
  const hits: Hit[] = [];

  // R11 Review gating applies to everyone, not just regulated businesses.
  if (tool.review_gating_feature) {
    hits.push({
      rule: "R11",
      state: "not_allowed",
      blocking: true,
      message: `${tool.name} can send only happy customers to Google. Google's rules and the FTC ban that.`,
      evidence_url: "https://support.google.com/contributionpolicy/answer/7400114?hl=en",
      icon: "shield",
    });
  }

  if (profile.regulated !== "hipaa") return hits;

  const baaUrl = tool.baa_evidence_url ?? evidenceFor(tool, "R8");

  if (tool.touches_patient_data === false) {
    if (tool.baa_note) {
      hits.push({
        rule: "R8",
        state: "snaps_caveat",
        message: tool.baa_note,
        evidence_url: baaUrl,
        icon: "shield",
      });
    }
    return hits;
  }

  if (!tool.baa) {
    hits.push({
      rule: "R8",
      state: "snaps_caveat",
      message: `We couldn't confirm that ${tool.name} signs a BAA, the contract HIPAA requires. Get one in writing before sharing patient data.`,
      evidence_url: tool.evidence[0]?.url,
      icon: "shield",
      unverified: true,
    });
    return hits;
  }

  // R8 No BAA at any tier.
  if (!tool.baa.available) {
    hits.push({
      rule: "R8",
      state: "not_allowed",
      blocking: true,
      message: `${tool.name} won't sign a BAA, the contract HIPAA requires for patient data. It can connect, but you can't legally use it here.`,
      evidence_url: baaUrl,
      icon: "shield",
    });
    return hits;
  }

  // R10 A feature this tool relies on is carved out of the BAA.
  const excluded = (tool.uses_features ?? []).filter((f) =>
    tool.baa?.excluded_features?.includes(f),
  );
  if (excluded.length > 0) {
    hits.push({
      rule: "R10",
      state: "not_allowed",
      blocking: true,
      message: `${tool.name} signs a BAA, but it doesn't cover ${list(excluded)}. Don't use that feature with patient data.`,
      evidence_url: baaUrl,
      icon: "shield",
    });
    return hits;
  }

  // R9 BAA only on a higher tier.
  if (tool.baa.min_tier) {
    const need = tierRank(tool, tool.baa.min_tier);
    const have = tierRank(tool, ownedTierName(tool, profile));
    if (need >= 0 && have < need) {
      const delta = tierDelta(tool, ownedTierName(tool, profile), tool.baa.min_tier);
      hits.push({
        rule: "R9",
        state: "needs_upgrade",
        message: `${tool.name} signs a BAA only on ${tool.baa.min_tier}. Don't share patient data until you upgrade.`,
        evidence_url: baaUrl,
        icon: "shield",
        required_tier: tool.baa.min_tier,
        extra_monthly_usd: delta,
      });
    }
  }

  return hits;
}

function tierDelta(tool: Tool, from: string | undefined, to: string): number {
  const fromPrice = tool.tiers.find((t) => t.name === from)?.monthly_usd ?? 0;
  const toPrice = tool.tiers.find((t) => t.name === to)?.monthly_usd ?? 0;
  return Math.max(0, toPrice - fromPrice);
}

// ---------- Rules on a pair ----------

/** Does this edge carry data the way the need asks for? */
function directionOk(edge: Edge, tool: Tool, needed: Need["direction"]): boolean {
  if (!needed || edge.direction === "two_way") return true;
  if (needed === "two_way") return false;
  const leavesTool =
    (edge.from === tool.id && edge.direction === "from_to") ||
    (edge.to === tool.id && edge.direction === "to_from");
  return needed === "from_tool" ? leavesTool : !leavesTool;
}

function directionWords(edge: Edge, catalog: Catalog): string {
  const a = catalog.byId.get(edge.from)?.name ?? edge.from;
  const b = catalog.byId.get(edge.to)?.name ?? edge.to;
  return edge.direction === "to_from" ? `${b} to ${a}` : `${a} to ${b}`;
}

function pathRules(
  tool: Tool,
  other: Tool,
  need: Need | undefined,
  profile: BusinessProfile,
  catalog: Catalog,
): Hit[] {
  const hits: Hit[] = [];
  const edges = edgesBetween(tool.id, other.id, catalog);
  const usable = edges.filter((e) => e.type !== "none");
  const active = usable.filter((e) => e.status === "active");

  // R12 Deprecated: there was a connector and it no longer works.
  if (usable.length > 0 && active.length === 0) {
    const old = usable[0];
    hits.push({
      rule: "R12",
      state: "was_compatible",
      blocking: true,
      message: `${tool.name} used to connect to ${other.name}, but that connection was ${old.status}. ${old.note ?? ""}`.trim(),
      evidence_url: old.evidence_url,
      icon: "clock",
      unverified: !old.verified,
    });
    return hits;
  }

  // R7 / R5 No path.
  if (active.length === 0) {
    if (!need) return hits;
    if (tool.standalone_ok) {
      hits.push({
        rule: "R7",
        state: tool.standalone_ok.caveat ? "snaps_caveat" : "snaps",
        message: tool.standalone_ok.message,
        icon: "wrench",
        evidence_url: tool.evidence[0]?.url,
      });
      return hits;
    }
    if (other.partner_only_api) {
      hits.push({
        rule: "R5",
        state: "doesnt_fit",
        blocking: true,
        message: `${other.name} only opens its data to approved partners, and ${tool.name} isn't one we could confirm.`,
        evidence_url: evidenceFor(other, "R5"),
        icon: "lock",
      });
      return hits;
    }
    const documented = edges.find((e) => e.type === "none");
    hits.push({
      rule: "R7",
      state: "doesnt_fit",
      blocking: true,
      message: `We found no way to connect ${tool.name} to ${other.name}.`,
      evidence_url: documented?.evidence_url ?? tool.evidence[0]?.url,
      icon: "lock",
      unverified: documented ? !documented.verified : undefined,
    });
    return hits;
  }

  // Prefer the strongest connection when several exist.
  const direct = active.filter((e) => e.type !== "ipaas" && e.type !== "bridge_app");
  const chosen = direct[0] ?? active[0];

  // R17 Tier-gated: only an owned base system can be "upgraded"; a tool you haven't
  // bought yet simply starts at the cheapest plan that works (see plan/cost.ts).
  const gates: [Tool, string | undefined][] = [
    [chosen.from === tool.id ? tool : other, chosen.min_tier_from],
    [chosen.to === tool.id ? tool : other, chosen.min_tier_to],
  ];
  for (const [gated, minTier] of gates) {
    if (!minTier) continue;
    const owned = ownedTierName(gated, profile);
    if (owned && tierRank(gated, owned) < tierRank(gated, minTier)) {
      const delta = tierDelta(gated, owned, minTier);
      hits.push({
        rule: "R17",
        state: "needs_upgrade",
        message: `This connection needs ${gated.name} ${minTier}. You're on ${owned}, so that adds $${delta} a month.`,
        evidence_url: chosen.evidence_url,
        icon: "lock",
        unverified: !chosen.verified,
        required_tier: minTier,
        extra_monthly_usd: delta,
      });
    }
  }

  // R18 / R19 Adapter paths.
  if (chosen.type === "ipaas" || chosen.type === "bridge_app") {
    const adapter = chosen.via ? catalog.byId.get(chosen.via) : undefined;
    const name = adapter?.name ?? "a connector app";
    const free = adapter?.tiers.find((t) => t.monthly_usd === 0);
    const cost = free ? 0 : (adapter?.tiers[0]?.monthly_usd ?? 0);
    const lag = chosen.latency_minutes
      ? ` Updates about every ${chosen.latency_minutes} minutes on the cheapest plan.`
      : "";
    const priceWords = free ? `${name} has a free plan.` : `${name} costs $${cost} a month.`;
    hits.push({
      rule: chosen.type === "ipaas" ? "R18" : "R19",
      state: "snaps_adapter",
      message: `${chosen.note ? `${chosen.note} ` : `Connects only through ${name}. `}${priceWords}${lag}`,
      evidence_url: chosen.evidence_url,
      icon: "wrench",
      adapter: chosen.via,
      unverified: !chosen.verified,
      extra_monthly_usd: cost,
    });
    if (adapter) hits.push(...complianceRules(adapter, profile));
  }

  // R20 One-way sync.
  if (need && !directionOk(chosen, tool, need.direction)) {
    hits.push({
      rule: "R20",
      state: "snaps_caveat",
      message: `Only syncs one way: ${directionWords(chosen, catalog)}. ${need.why}, and that won't happen automatically.`,
      evidence_url: chosen.evidence_url,
      icon: "arrow",
      unverified: !chosen.verified,
    });
  }

  // R21 Detail mismatch.
  if (need?.detail && chosen.detail && chosen.detail !== need.detail) {
    const sent = chosen.detail === "itemized" ? "every transaction" : "daily totals";
    const wanted = need.detail === "itemized" ? "every transaction" : "daily totals";
    hits.push({
      rule: "R21",
      state: "snaps_caveat",
      message: `Sends ${sent}, not ${wanted}. ${need.why}, so expect extra matching work.`,
      evidence_url: chosen.evidence_url,
      icon: "sigma",
      unverified: !chosen.verified,
    });
  }

  // R22 Sync lag on fast-moving data. Adapter lag is already part of R18.
  if (
    chosen.type !== "ipaas" &&
    chosen.latency_minutes &&
    chosen.latency_minutes > LAG_TOLERANCE_MINUTES &&
    chosen.entities.some((e) => FAST_ENTITIES.includes(e))
  ) {
    hits.push({
      rule: "R22",
      state: "snaps_caveat",
      message: `Updates only about every ${chosen.latency_minutes} minutes, so stock or bookings can be out of date.`,
      evidence_url: chosen.evidence_url,
      icon: "clock",
      unverified: !chosen.verified,
    });
  }

  // R26 Fee penalty.
  if (chosen.fee) {
    hits.push({
      rule: "R26",
      state: "snaps_cost",
      message: chosen.fee.note,
      evidence_url: chosen.evidence_url,
      icon: "tag",
      unverified: !chosen.verified,
      extra_monthly_usd: chosen.fee.monthly_usd ?? 0,
    });
  }

  // A one-line note about a connection that otherwise works.
  const alreadySaid = hits.some((h) => h.rule === "R18" || h.rule === "R19");
  if (chosen.note && !alreadySaid && hits.every((h) => h.rule !== "R21")) {
    hits.push({
      rule: "NOTE",
      state: "snaps",
      message: chosen.note,
      evidence_url: chosen.evidence_url,
      unverified: !chosen.verified,
    });
  }

  if (hits.length === 0) {
    hits.push({
      rule: "OK",
      state: "snaps",
      message: `Connects directly to ${other.name}.`,
      evidence_url: chosen.evidence_url,
      unverified: !chosen.verified,
    });
  } else if (!chosen.verified && hits.every((h) => !h.unverified)) {
    hits[0].unverified = true;
  }
  return hits;
}

function pairRules(
  tool: Tool,
  other: Tool,
  profile: BusinessProfile,
  catalog: Catalog,
): Hit[] {
  const hits: Hit[] = [];
  const anchor = resolveAnchor(profile, catalog);
  const accountingId = profile.base.accounting;
  const edition = profile.base.accounting_edition;

  // R1 Processor lock: the anchor only takes payments through its own rail.
  const lockedBase = [tool, other].find(
    (t) => t.id === anchor?.id && t.requires_processor,
  );
  if (lockedBase) {
    const outsider = lockedBase.id === tool.id ? other : tool;
    if (
      outsider.requires_processor &&
      outsider.requires_processor !== lockedBase.requires_processor
    ) {
      hits.push({
        rule: "R1",
        state: "doesnt_fit",
        blocking: true,
        message: `${lockedBase.name} only takes payments through its own system, so ${outsider.name} can't process your cards.`,
        evidence_url: evidenceFor(lockedBase, "R1"),
        icon: "lock",
      });
      return hits;
    }
  }

  // R3 Edition mismatch, and R4 payroll ledger lock, are about the accounting system.
  if (other.id === accountingId || tool.id === accountingId) {
    const product = other.id === accountingId ? tool : other;
    if (
      edition &&
      REAL_LEDGERS.has(edition) &&
      product.editions_supported &&
      !product.editions_supported.includes(edition)
    ) {
      const books = catalog.byId.get(accountingId ?? "")?.name ?? "your accounting";
      const supported = product.editions_supported
        .map((e) => catalog.byId.get(e)?.name ?? e)
        .join(" or ");
      hits.push({
        rule: "R3",
        state: "doesnt_fit",
        blocking: true,
        message: `${product.name} works with ${supported}, not ${books}. No adapter fixes this: you'd need to move your books.`,
        evidence_url: evidenceFor(product, "R3"),
        icon: "lock",
      });
      return hits;
    }
    if (
      edition &&
      REAL_LEDGERS.has(edition) &&
      product.ledger_lock &&
      !product.ledger_lock.includes(edition)
    ) {
      const books = catalog.byId.get(accountingId ?? "")?.name ?? "your accounting";
      hits.push({
        rule: "R4",
        state: "doesnt_fit",
        blocking: true,
        message: `${product.name} payroll can't post to ${books}.`,
        evidence_url: evidenceFor(product, "R4"),
        icon: "lock",
      });
      return hits;
    }
  }

  // Connection rules, from whichever side declares the need.
  const needOfTool = (tool.needs ?? []).find(
    (n) => counterpartFor(n, profile, catalog)?.id === other.id,
  );
  const needOfOther = (other.needs ?? []).find(
    (n) => counterpartFor(n, profile, catalog)?.id === tool.id,
  );
  const implicitNeed: Need | undefined =
    tool.kind === "ai_tool" &&
    !tool.needs &&
    !tool.standalone_ok &&
    other.id === anchor?.id
      ? { with: "anchor", entities: ["customers"], why: "It has to reach your main system" }
      : undefined;
  if (needOfOther && !needOfTool) {
    hits.push(...pathRules(other, tool, needOfOther, profile, catalog));
  } else {
    hits.push(...pathRules(tool, other, needOfTool ?? implicitNeed, profile, catalog));
  }
  if (hits.some((h) => h.blocking)) return hits;

  // R13 Overlapping owner: both claim the same records and nothing keeps them matched.
  const shared = tool.owns_entities.filter((e) => other.owns_entities.includes(e));
  const unsynced = shared.filter(
    (entity) =>
      !edgesBetween(tool.id, other.id, catalog).some(
        (e) => e.status === "active" && e.direction === "two_way" && e.entities.includes(entity),
      ),
  );
  if (unsynced.length > 0) {
    hits.push({
      rule: "R13",
      state: "overlaps",
      message: `Both ${tool.name} and ${other.name} keep ${list(unsynced.map((e) => ENTITY_WORD[e]))}. Pick one as the source of truth, or you'll get duplicates.`,
      evidence_url:
        edgesBetween(tool.id, other.id, catalog)[0]?.evidence_url ??
        evidenceFor(tool, "R13") ??
        evidenceFor(other, "R13"),
      icon: "wrench",
    });
  }

  // R14 Single writer.
  const writers: [keyof Tool, string][] = [
    ["writes_inventory", "stock counts"],
    ["writes_rates", "nightly prices"],
    ["posts_sales_to_accounting", "sales to your books"],
    ["bookable_calendar", "bookings to a calendar"],
  ];
  for (const [flag, words] of writers) {
    if (tool[flag] && other[flag]) {
      hits.push({
        rule: "R14",
        state: "overlaps",
        message: `Both ${tool.name} and ${other.name} write ${words}. Keep one, or you'll get double entries.`,
        evidence_url:
          "https://qoblex.com/blog/shopify-quickbooks-integration-not-syncing-12-common-causes-and-how-to-fix-them-2026-guide/",
        icon: "wrench",
        unverified: true,
      });
    }
  }

  // R16 Mutually exclusive by vendor design.
  const exclusive =
    tool.mutually_exclusive_with?.find((x) => x.tool === other.id) ??
    other.mutually_exclusive_with?.find((x) => x.tool === tool.id);
  if (exclusive) {
    hits.push({
      rule: "R16",
      state: "overlaps",
      message: exclusive.note,
      evidence_url: exclusive.evidence_url,
      icon: "wrench",
    });
  }

  return hits;
}

function includedRule(
  tool: Tool,
  profile: BusinessProfile,
  catalog: Catalog,
): Hit | undefined {
  // R15 Already in the anchor.
  const anchor = resolveAnchor(profile, catalog);
  if (!anchor) return undefined;
  const match = tool.included_in?.find((i) => i.base_system === anchor.id);
  if (!match) return undefined;
  const owned = ownedTierName(anchor, profile);
  const covered = !match.min_tier || tierRank(anchor, owned) >= tierRank(anchor, match.min_tier);
  const addon = tool.tiers[0]?.monthly_usd;
  return {
    rule: "R15",
    state: "overlaps",
    badge: "already_included",
    message: covered
      ? `Already included in your ${anchor.name} plan. Nothing new to buy.`
      : `A ${anchor.name} add-on${addon ? ` for $${addon} a month` : ""}, and included on ${match.min_tier}. No new vendor to manage.`,
    evidence_url: evidenceFor(tool, "R15"),
    icon: "tag",
  };
}

function setupRules(tool: Tool, profile: BusinessProfile): Hit[] {
  const hits: Hit[] = [];
  // R23 Setup or consent steps.
  if (tool.sends_sms && !tool.handles_10dlc) {
    hits.push({
      rule: "R23",
      state: "snaps_caveat",
      message:
        "Texting customers requires a one-time 10DLC registration, or carriers may block your messages. You'll need your legal business name and EIN.",
      evidence_url:
        "https://www.conduit.ai/blog/what-is-a2p-10dlc-and-why-your-business-text-messages-are-getting-blocked",
      icon: "wrench",
    });
  }
  if (tool.touches_client_confidential && profile.regulated === "tax_7216") {
    hits.push({
      rule: "R23",
      state: "snaps_caveat",
      message: "Get each client's written consent first: federal tax law (section 7216) requires it.",
      evidence_url: "https://www.thetaxadviser.com/issues/2024/jan/the-many-implications-of-sec-7216/",
      icon: "wrench",
    });
  }
  if (tool.touches_client_confidential && profile.regulated === "legal_aba") {
    hits.push({
      rule: "R23",
      state: "snaps_caveat",
      message: "Consult your client first: ABA Formal Opinion 512 asks lawyers to protect client information when using AI.",
      evidence_url:
        "https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/",
      icon: "wrench",
    });
  }
  return hits;
}

// ---------- Combining hits ----------

function combine(toolId: string, hits: Hit[], badges: Badge[]): Verdict {
  const toReason = (h: Hit): Reason => ({
    rule: h.rule,
    message: h.message,
    evidence_url: h.evidence_url,
    icon: h.icon,
    unverified: h.unverified,
  });

  const blocking = hits.find((h) => h.blocking);
  if (blocking) {
    return {
      toolId,
      state: blocking.state,
      visible: VISIBLE[blocking.state],
      reasons: [toReason(blocking)],
      badges: uniqueBadges(badges, blocking.unverified),
      extra_monthly_usd: 0,
      hidden: blocking.hidden,
    };
  }

  let state: InternalState = "snaps";
  for (const h of hits) {
    if ((STACK_RANK[h.state] ?? 0) > (STACK_RANK[state] ?? 0)) state = h.state;
  }
  const required = hits.filter((h) => h.required_tier).map((h) => h.required_tier as string);
  return {
    toolId,
    state,
    visible: VISIBLE[state],
    reasons: hits.map(toReason),
    badges: uniqueBadges(
      [...badges, ...hits.flatMap((h) => (h.badge ? [h.badge] : []))],
      hits.some((h) => h.unverified),
    ),
    adapter: hits.find((h) => h.adapter)?.adapter,
    extra_monthly_usd: hits.reduce((sum, h) => sum + (h.extra_monthly_usd ?? 0), 0),
    required_tier: required[0],
  };
}

function uniqueBadges(badges: Badge[], unverified: boolean | undefined): Badge[] {
  const all = new Set(badges);
  if (unverified) all.add("unverified");
  return [...all];
}

function startingBadges(tool: Tool): Badge[] {
  const badges: Badge[] = [];
  // R27 Switching lock-in.
  if (tool.contract_term) badges.push("hard_to_swap");
  if (!tool.verified) badges.push("unverified");
  return badges;
}

// ---------- Public API ----------

/**
 * Verdict for one tool given everything the business runs (SPEC M8).
 * Pair checks run against the anchor, every base system and every other chosen tool.
 */
export function evaluate(
  tool: Tool,
  profile: BusinessProfile,
  chosenTools: Tool[],
  catalog: Catalog,
): Verdict {
  const others = dedupeTools([...baseSystems(profile, catalog), ...chosenTools]).filter(
    (t) => t.id !== tool.id,
  );

  const pair = others.flatMap((other) => pairRules(tool, other, profile, catalog));

  const ordered: Hit[] = [
    ...toolRules(tool, profile, catalog),
    ...pair.filter((h) => h.blocking && ["R1", "R3", "R4", "R5", "R7"].includes(h.rule)),
    ...complianceRules(tool, profile),
    ...pair.filter((h) => h.state === "not_allowed"),
    ...pair.filter((h) => h.blocking && h.rule === "R12"),
    ...(includedRuleList(tool, profile, catalog)),
    ...pair.filter((h) => !h.blocking),
    ...setupRules(tool, profile),
  ];

  return combine(tool.id, tidy(ordered), startingBadges(tool));
}

function includedRuleList(tool: Tool, profile: BusinessProfile, catalog: Catalog): Hit[] {
  const hit = includedRule(tool, profile, catalog);
  return hit ? [hit] : [];
}

/** Removes repeated reasons (the same rule can fire against more than one system). */
function tidy(hits: Hit[]): Hit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.rule}|${h.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeTools(tools: Tool[]): Tool[] {
  const seen = new Set<string>();
  return tools.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** Result for one specific connection, shown on a seam of the board. */
export function evaluateSeam(
  a: Tool,
  b: Tool,
  profile: BusinessProfile,
  catalog: Catalog,
): Seam {
  const hits = pairRules(a, b, profile, catalog);
  const anchorId = resolveAnchor(profile, catalog)?.id;
  const compliance = [a, b]
    .filter((t) => t.id !== anchorId && t.kind !== "base_system")
    .flatMap((t) => complianceRules(t, profile));
  const ordered = [
    ...hits.filter((h) => h.blocking && h.state !== "was_compatible"),
    ...compliance,
    ...hits.filter((h) => !(h.blocking && h.state !== "was_compatible")),
  ];
  const v = combine(a.id, tidy(ordered), []);
  return { a: a.id, b: b.id, state: v.state, visible: v.visible, reasons: v.reasons };
}

/**
 * All connections worth showing on the board: each chosen tool against the anchor,
 * the anchor against accounting, and any other pair that has an edge or a conflict.
 */
export function evaluateSeams(
  profile: BusinessProfile,
  chosenTools: Tool[],
  catalog: Catalog,
): Seam[] {
  const anchor = resolveAnchor(profile, catalog);
  const all = dedupeTools([...baseSystems(profile, catalog), ...chosenTools]);
  const seams: Seam[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const seam = evaluateSeam(b, a, profile, catalog);
      const touchesAnchor = a.id === anchor?.id || b.id === anchor?.id;
      const hasEdge = edgesBetween(a.id, b.id, catalog).length > 0;
      const meaningful = seam.reasons.length > 0 && seam.state !== "snaps";
      if (touchesAnchor || hasEdge || meaningful) {
        if (seam.reasons.length > 0) seams.push(seam);
      }
    }
  }
  return seams;
}

/** The most serious visible state, for labeling a piece that has several seams. */
export function worstVisible(states: VisibleState[]): VisibleState {
  const order: VisibleState[] = ["not_allowed", "no_fit", "catch", "fits"];
  for (const s of order) if (states.includes(s)) return s;
  return "fits";
}
