import { describe, expect, it } from "vitest";
import { catalog } from "@/modules/taxonomy/catalog";
import type { BusinessProfile } from "@/modules/taxonomy/types";
import {
  applyAnswer,
  KIT_SIZE,
  kitState,
  NOT_SURE,
  questionsThatMatter,
  topPicks,
  type KitInput,
} from "./kit";

const blank: BusinessProfile = {
  description: "",
  archetypes: ["food_bev"],
  employees: 2,
  locations: 1,
  mobile: false,
  base: { channels: [] },
  selected_tiers: {},
  devices: [],
  connectivity: "reliable",
  regulated: "none",
  sells_on: [],
};

const input = (over: Partial<KitInput> = {}): KitInput => ({
  profile: blank,
  pieces: {},
  pains: ["customer_comm"],
  skipped: [],
  ...over,
});

describe("kit", () => {
  it("puts the owner's own problem first and stays within six jobs", () => {
    const kit = kitState(input(), catalog);
    expect(kit.wedges.length).toBeLessThanOrEqual(KIT_SIZE);
    expect(kit.wedges[0].block.id).toBe("customer_comm");
    expect(kit.wedges[0].status).toBe("next");
    expect(kit.wedges.slice(1).every((w) => w.status === "locked")).toBe(true);
  });

  it("unlocks the next job once one is covered", () => {
    const kit = kitState(input({ pieces: { customer_comm: "rosie" } }), catalog);
    expect(kit.wedges[0].status).toBe("added");
    expect(kit.wedges[1].status).toBe("next");
  });

  it("closes when every job has an answer, without buying a tool for each", () => {
    const first = kitState(input(), catalog);
    const kit = kitState(input({ skipped: first.wedges.map((w) => w.block.id) }), catalog);
    expect(kit.complete).toBe(true);
  });

  it("counts what the main system already includes", () => {
    const toast = applyAnswer(blank, { id: "core", prompt: "", options: [] }, "toast", catalog);
    const kit = kitState(input({ profile: toast, pains: ["recipe_costing"] }), catalog);
    expect(kit.wedges[0]).toMatchObject({ status: "included" });
    const picks = topPicks(input({ profile: toast, pains: ["recipe_costing"] }), catalog);
    expect(picks[0].kind).toBe("included");
  });

  it("does not suggest a second tool for a job that is already filled", () => {
    const picks = topPicks(input({ pieces: { customer_comm: "rosie" } }), catalog);
    const forCalls = picks.filter((p) => p.block.id === "customer_comm");
    expect(forCalls).toHaveLength(1);
    expect(forCalls[0]).toMatchObject({ kind: "tool", added: true });
  });
});

describe("questions that matter", () => {
  it("asks how a restaurant takes payments, because it changes verdicts", () => {
    const qs = questionsThatMatter(input(), [], catalog);
    expect(qs[0].id).toBe("core");
    expect(qs[0].options.map((o) => o.value)).toContain("toast");
  });

  it("stops asking once answered, even with not sure", () => {
    const qs = questionsThatMatter(input(), ["core"], catalog);
    expect(qs.map((q) => q.id)).not.toContain("core");
    const q = questionsThatMatter(input(), [], catalog)[0];
    expect(applyAnswer(blank, q, NOT_SURE, catalog)).toEqual(blank);
  });

  it("asks a clinic about patient records, because HIPAA changes verdicts", () => {
    const clinic = { ...blank, archetypes: ["clinics" as const] };
    const qs = questionsThatMatter(input({ profile: clinic, pains: ["customer_comm"] }), ["core"], catalog);
    expect(qs.map((q) => q.id)).toContain("reg:hipaa");
  });
});
