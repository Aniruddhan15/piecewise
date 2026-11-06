import { describe, expect, it } from "vitest";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import type { BusinessProfile, Catalog, Tool } from "@/modules/taxonomy/types";
import { buildCatalog, rawData } from "@/modules/taxonomy/catalog";
import { evaluate, evaluateSeam, evaluateSeams, resolveAnchor } from "./engine";

const t = (id: string): Tool => {
  const tool = catalog.byId.get(id);
  if (!tool) throw new Error(`unknown tool ${id}`);
  return tool;
};

function profile(overrides: Partial<BusinessProfile> & { base?: BusinessProfile["base"] }): BusinessProfile {
  return {
    description: "",
    archetypes: ["food_bev"],
    employees: 3,
    locations: 1,
    mobile: false,
    selected_tiers: {},
    devices: [],
    connectivity: "reliable",
    regulated: "none",
    sells_on: [],
    base: { channels: [] },
    ...overrides,
  };
}

const toastRestaurant = profile({
  archetypes: ["food_bev"],
  anchor: "toast",
  base: { payments_pos: "toast", accounting: "qbo", accounting_edition: "qbo", channels: [] },
  selected_tiers: { toast: "Point of Sale" },
});

const squareCafe = profile({
  archetypes: ["food_bev"],
  anchor: "square_pos",
  base: { payments_pos: "square_pos", accounting: "qbo", accounting_edition: "qbo", channels: [] },
});

const hvacDesktop = profile({
  archetypes: ["field_services"],
  anchor: "jobber",
  base: { customer_records: "jobber", accounting: "qbd", accounting_edition: "qbd", channels: [] },
  selected_tiers: { jobber: "Core" },
});

const landscaperOnline = profile({
  archetypes: ["field_services"],
  anchor: "jobber",
  base: { customer_records: "jobber", accounting: "qbo", accounting_edition: "qbo", channels: [] },
  selected_tiers: { jobber: "Core" },
});

const dental = profile({
  archetypes: ["clinics"],
  anchor: "open_dental",
  regulated: "hipaa",
  base: { customer_records: "open_dental", accounting: "qbo", accounting_edition: "qbo", channels: [] },
});

describe("the six demo stories (M8.F2)", () => {
  it("R1: an outside processor doesn't fit a Toast restaurant", () => {
    const v = evaluate(t("stripe"), toastRestaurant, [], catalog);
    expect(v.state).toBe("doesnt_fit");
    expect(v.visible).toBe("no_fit");
    expect(v.reasons[0].rule).toBe("R1");
    expect(v.reasons[0].evidence_url).toContain("toasttab.com");
  });

  it("R8: Mailchimp is not allowed for a dental office", () => {
    const v = evaluate(t("mailchimp"), dental, [], catalog);
    expect(v.state).toBe("not_allowed");
    expect(v.visible).toBe("not_allowed");
    expect(v.reasons[0].rule).toBe("R8");
    expect(v.reasons[0].evidence_url).toContain("paubox.com");
  });

  it("R3: Jobber doesn't fit a contractor on QuickBooks Desktop", () => {
    const seam = evaluateSeam(t("jobber"), t("qbd"), hvacDesktop, catalog);
    expect(seam.state).toBe("doesnt_fit");
    expect(seam.reasons[0].rule).toBe("R3");
    expect(seam.reasons[0].message).toMatch(/Desktop/);
  });

  it("R18: Zapier appears as an adapter with a 15-minute badge", () => {
    const v = evaluate(t("nicejob"), squareCafe, [], catalog);
    expect(v.state).toBe("snaps_adapter");
    expect(v.visible).toBe("catch");
    expect(v.adapter).toBe("zapier");
    const reason = v.reasons.find((r) => r.rule === "R18");
    expect(reason?.message).toMatch(/15 minutes/);
  });

  it("R13: Shopify POS and QuickBooks Online both own customers and items", () => {
    const shop = profile({
      archetypes: ["retail"],
      anchor: "shopify_pos",
      base: { payments_pos: "shopify_pos", accounting: "qbo", accounting_edition: "qbo", channels: [] },
    });
    const seam = evaluateSeam(t("shopify_pos"), t("qbo"), shop, catalog);
    expect(seam.state).toBe("overlaps");
    expect(seam.visible).toBe("catch");
    const reason = seam.reasons.find((r) => r.rule === "R13");
    expect(reason?.message).toMatch(/customers/);
    expect(reason?.message).toMatch(/products/);
  });

  it("R21: Square to QuickBooks Online sends every sale, not daily totals", () => {
    const seam = evaluateSeam(t("square_pos"), t("qbo"), squareCafe, catalog);
    expect(seam.visible).toBe("catch");
    const reason = seam.reasons.find((r) => r.rule === "R21");
    expect(reason?.message).toMatch(/every transaction/);
    expect(reason?.evidence_url).toContain("quickbooks.intuit.com");
  });
});

describe("context changes the answer (M8.F3)", () => {
  const vet = profile({ archetypes: ["clinics"], regulated: "none", base: { channels: [] } });
  const salon = profile({
    archetypes: ["appointments"],
    anchor: "square_appointments",
    base: { payments_pos: "square_appointments", channels: [] },
  });

  it("Mailchimp fits a vet clinic", () => {
    expect(evaluate(t("mailchimp"), vet, [], catalog).visible).toBe("fits");
  });
  it("Mailchimp fits a salon", () => {
    expect(evaluate(t("mailchimp"), salon, [], catalog).visible).toBe("fits");
  });
  it("Mailchimp is not allowed for a dental clinic", () => {
    expect(evaluate(t("mailchimp"), dental, [], catalog).visible).toBe("not_allowed");
  });
});

describe("MUST rules", () => {
  it("R6: a Toast-only tool is hidden off Toast and shown on Toast", () => {
    expect(evaluate(t("xtrachef"), squareCafe, [], catalog).hidden).toBe(true);
    expect(evaluate(t("xtrachef"), toastRestaurant, [], catalog).hidden).toBeFalsy();
  });

  it("R7: no path is doesn't fit when the tool can't work alone", () => {
    const v = evaluate(t("nicejob"), toastRestaurant, [], catalog);
    // Toast's API is partner-only, so R5 explains the missing path.
    expect(v.visible).toBe("no_fit");
    expect(["R5", "R7"]).toContain(v.reasons[0].rule);
  });

  it("R7: no path on an open system reads as no way to connect", () => {
    const v = evaluate(t("seven_shifts"), landscaperOnline, [], catalog);
    expect(v.visible).toBe("no_fit");
    expect(v.reasons[0].rule).toBe("R7");
  });

  it("R14: two tools posting sales to QuickBooks overlap", () => {
    const v = evaluate(t("synder"), squareCafe, [], catalog);
    expect(v.state).toBe("overlaps");
    expect(v.reasons.some((r) => r.rule === "R14" && /sales to your books/.test(r.message))).toBe(true);
  });

  it("R15: Jobber AI Receptionist is an add-on below Plus and included on Plus", () => {
    const addOn = evaluate(t("jobber_ai_receptionist"), landscaperOnline, [], catalog);
    expect(addOn.badges).toContain("already_included");
    expect(addOn.reasons.find((r) => r.rule === "R15")?.message).toMatch(/add-on/);

    const plus = { ...landscaperOnline, selected_tiers: { jobber: "Plus" } };
    const included = evaluate(t("jobber_ai_receptionist"), plus, [], catalog);
    expect(included.reasons.find((r) => r.rule === "R15")?.message).toMatch(/Already included/);
  });

  it("R17: QuickBooks sync on Jobber Core needs Connect, +$70", () => {
    const seam = evaluateSeam(t("jobber"), t("qbo"), landscaperOnline, catalog);
    expect(seam.state).toBe("overlaps"); // R13 stacks above the upgrade
    const reason = seam.reasons.find((r) => r.rule === "R17");
    expect(reason?.message).toMatch(/Connect/);
    expect(reason?.message).toMatch(/\$70/);
  });

  it("R17 goes away once on Connect", () => {
    const connect = { ...landscaperOnline, selected_tiers: { jobber: "Connect" } };
    const seam = evaluateSeam(t("jobber"), t("qbo"), connect, catalog);
    expect(seam.reasons.find((r) => r.rule === "R17")).toBeUndefined();
  });

  it("R20: the Jobber to QuickBooks sync only runs one way", () => {
    const seam = evaluateSeam(t("jobber"), t("qbo"), landscaperOnline, catalog);
    expect(seam.reasons.find((r) => r.rule === "R20")?.message).toMatch(/one way/);
  });

  it("R27: Toast shows as hard to swap", () => {
    expect(evaluate(t("toast"), toastRestaurant, [], catalog).badges).toContain("hard_to_swap");
  });

  it("Rosie is a catch that says it doesn't book into Jobber (M7 accept)", () => {
    const v = evaluate(t("rosie"), landscaperOnline, [], catalog);
    expect(v.visible).toBe("catch");
    expect(v.reasons.map((r) => r.message).join(" ")).toMatch(/doesn't book into Jobber/);
  });

  it("the all-green path exists: NiceJob on Jobber fits", () => {
    const v = evaluate(t("nicejob"), landscaperOnline, [], catalog);
    expect(v.state).toBe("snaps");
    expect(v.visible).toBe("fits");
  });

  it("a Zapier adapter is itself checked for HIPAA", () => {
    // A BAA-covered tool whose only path runs through Zapier is still not allowed.
    const base = rawData;
    const tool: Tool = { ...t("nexhealth"), id: "test_tool", needs: [{ with: "anchor", entities: ["customers"], why: "x" }] };
    const test = buildCatalog({
      ...base,
      tools: [...base.tools, tool],
      edges: [
        ...base.edges,
        { ...base.edges[0], from: "test_tool", to: "open_dental", type: "ipaas", via: "zapier", direction: "from_to", entities: ["customers"], min_tier_from: undefined, note: undefined },
      ],
    });
    const v = evaluate(tool, dental, [], test);
    expect(v.visible).toBe("not_allowed");
    expect(v.reasons[0].message).toMatch(/Zapier/);
  });
});

describe("SHOULD rules", () => {
  function withTool(tool: Partial<Tool> & { id: string }): { tool: Tool; cat: Catalog } {
    const full: Tool = { ...t("mailchimp"), standalone_ok: { message: "alone" }, needs: undefined, baa: undefined, ...tool };
    return { tool: full, cat: buildCatalog({ ...rawData, tools: [...rawData.tools, full] }) };
  }

  it("R2: a tool that doesn't run on your devices doesn't fit", () => {
    const { tool, cat } = withTool({ id: "x", os_supported: ["windows"] });
    const v = evaluate(tool, { ...squareCafe, devices: ["ios"] }, [], cat);
    expect(v.reasons[0].rule).toBe("R2");
  });

  it("R4: Gusto can't post to Wave", () => {
    const wave = { ...squareCafe, base: { ...squareCafe.base, accounting: "wave", accounting_edition: "wave" as const } };
    const v = evaluate(t("gusto"), wave, [], catalog);
    expect(v.reasons[0].rule).toBe("R4");
  });

  it("R5: a partner-only anchor blocks an unlisted tool", () => {
    const { tool, cat } = withTool({ id: "x", standalone_ok: undefined, needs: [{ with: "anchor", entities: ["orders"], why: "x" }] });
    const v = evaluate(tool, toastRestaurant, [], cat);
    expect(v.reasons[0].rule).toBe("R5");
  });

  it("R9: a BAA on a higher tier needs an upgrade", () => {
    const { tool, cat } = withTool({ id: "x", baa: { available: true, min_tier: "Standard" } });
    const v = evaluate(tool, { ...dental, selected_tiers: { x: "Free" } }, [], cat);
    expect(v.state).toBe("needs_upgrade");
    expect(v.reasons.some((r) => r.rule === "R9")).toBe(true);
  });

  it("R10: a feature outside the BAA is not allowed", () => {
    const { tool, cat } = withTool({ id: "x", baa: { available: true, excluded_features: ["AI Companion"] }, uses_features: ["AI Companion"] });
    const v = evaluate(tool, dental, [], cat);
    expect(v.reasons[0].rule).toBe("R10");
    expect(v.visible).toBe("not_allowed");
  });

  it("R11: review gating is not allowed for anyone", () => {
    const { tool, cat } = withTool({ id: "x", review_gating_feature: true });
    const v = evaluate(tool, squareCafe, [], cat);
    expect(v.visible).toBe("not_allowed");
    expect(v.reasons[0].rule).toBe("R11");
  });

  it("R12: a retired connection reads as was compatible", () => {
    const tool: Tool = { ...t("mailchimp"), id: "x", standalone_ok: undefined, baa: undefined };
    const cat = buildCatalog({
      ...rawData,
      tools: [...rawData.tools, tool],
      edges: [{ ...rawData.edges[0], from: "x", to: "square_pos", status: "deprecated", min_tier_from: undefined, note: undefined }],
    });
    const v = evaluate(tool, squareCafe, [], cat);
    expect(v.state).toBe("was_compatible");
    expect(v.visible).toBe("no_fit");
  });

  it("R16: documented mutual exclusion overlaps", () => {
    const { tool, cat } = withTool({ id: "x", mutually_exclusive_with: [{ tool: "qbo", note: "These disable each other.", evidence_url: "https://example.com/" }] });
    const v = evaluate(tool, squareCafe, [], cat);
    expect(v.reasons.some((r) => r.rule === "R16")).toBe(true);
  });

  it("R22: slow sync on fast-moving data gets a clock", () => {
    const tool: Tool = { ...t("cin7"), id: "x", ecosystem_lock: undefined, needs: [{ with: "anchor", entities: ["items"], why: "x" }] };
    const cat = buildCatalog({
      ...rawData,
      tools: [...rawData.tools, tool],
      edges: [{ ...rawData.edges[0], from: "x", to: "square_pos", direction: "two_way", entities: ["items"], latency_minutes: 30, min_tier_from: undefined, note: undefined }],
    });
    const v = evaluate(tool, squareCafe, [], cat);
    expect(v.reasons.some((r) => r.rule === "R22")).toBe(true);
  });

  it("R23: SMS needs 10DLC registration", () => {
    const v = evaluate(t("sameday"), landscaperOnline, [], catalog);
    expect(v.reasons.some((r) => r.rule === "R23" && /10DLC/.test(r.message))).toBe(true);
  });

  it("R23: AI on tax data needs client consent", () => {
    const tax = profile({ archetypes: ["professional"], regulated: "tax_7216", base: { channels: [] } });
    const v = evaluate(t("smartvault"), tax, [], catalog);
    expect(v.reasons.some((r) => r.rule === "R23" && /7216/.test(r.message))).toBe(true);
  });
});

describe("every reason is explainable (M8.F4, P9)", () => {
  it("each reason on each demo has a rule, message and evidence link", () => {
    for (const demo of demos) {
      const chosen = Object.values(demo.pieces).map(t);
      for (const seam of evaluateSeams(demo.profile, chosen, catalog)) {
        for (const r of seam.reasons) {
          expect(r.rule, `${demo.id}: ${seam.a}+${seam.b}`).toBeTruthy();
          expect(r.message, `${demo.id}: ${seam.a}+${seam.b}`).toBeTruthy();
          expect(r.evidence_url, `${demo.id}: ${seam.a}+${seam.b}: ${r.rule}`).toBeTruthy();
        }
      }
    }
  });
});

describe("demos show every visible state", () => {
  it("across all demo boards, all four states appear", () => {
    const states = new Set<string>();
    for (const demo of demos) {
      const chosen = Object.values(demo.pieces).map(t);
      for (const seam of evaluateSeams(demo.profile, chosen, catalog)) states.add(seam.visible);
      for (const tool of chosen) {
        const others = chosen.filter((c) => c.id !== tool.id);
        states.add(evaluate(tool, demo.profile, others, catalog).visible);
      }
    }
    expect([...states].sort()).toEqual(["catch", "fits", "no_fit", "not_allowed"]);
  });

  it("each demo resolves its anchor", () => {
    for (const demo of demos) {
      expect(resolveAnchor(demo.profile, catalog)?.id).toBe(demo.profile.anchor);
    }
  });
});
