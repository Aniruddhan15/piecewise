import { describe, expect, it, vi } from "vitest";
import { cacheKey, createGateway, jsonSchemaFor, type GatewayConfig, type LLMClient } from "./gateway";
import { addsNewNumbers, ClassifyOutput } from "./tasks";

const config: GatewayConfig = {
  enabled: true,
  models: { fast: "fast-model", smart: "smart-model", fallback: "fallback-model" },
  dailyCap: 100,
  hourlyPerIp: 30,
};

const classifyInput = { description: "bakery that also sells coffee beans" };
const good = JSON.stringify({
  archetypes: ["food_bev", "retail"],
  naics: { code: "311811", title: "Retail bakeries" },
  confidence: 0.9,
  suggested_extra_blocks: [],
});

function clientReturning(...answers: (string | Error)[]): LLMClient & { complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn(async () => {
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next ?? "";
  });
  return { complete };
}

describe("callLLM", () => {
  it("returns validated output from the primary model", async () => {
    const client = clientReturning(good);
    const gw = createGateway({ config, client, precomputed: {} });
    const out = await gw.call<{ archetypes: string[] }>("classify_business", classifyInput);
    expect(out?.archetypes).toEqual(["food_bev", "retail"]);
    expect(client.complete.mock.calls[0][0].model).toBe("fast-model");
    expect(client.complete.mock.calls[0][0].temperature).toBe(0);
  });

  it("retries once with the fallback model on a parse failure", async () => {
    const client = clientReturning("not json", good);
    const gw = createGateway({ config, client, precomputed: {} });
    expect(await gw.call("classify_business", classifyInput)).not.toBeNull();
    expect(client.complete.mock.calls[1][0].model).toBe("fallback-model");
  });

  it("retries once with the fallback model on an API error", async () => {
    const client = clientReturning(new Error("502"), good);
    const gw = createGateway({ config, client, precomputed: {} });
    expect(await gw.call("classify_business", classifyInput)).not.toBeNull();
  });

  it("returns null when both fail, so the caller uses its fallback", async () => {
    const client = clientReturning(new Error("502"), "{}");
    const gw = createGateway({ config, client, precomputed: {} });
    expect(await gw.call("classify_business", classifyInput)).toBeNull();
    expect(client.complete).toHaveBeenCalledTimes(2);
  });

  it("caches by task and input", async () => {
    const client = clientReturning(good);
    const gw = createGateway({ config, client, precomputed: {} });
    await gw.call("classify_business", classifyInput);
    await gw.call("classify_business", classifyInput);
    expect(client.complete).toHaveBeenCalledTimes(1);
  });

  it("serves precomputed demo outputs with no live call, even when disabled", async () => {
    const client = clientReturning();
    const key = cacheKey("classify_business", classifyInput);
    const gw = createGateway({
      config: { ...config, enabled: false },
      client,
      precomputed: { [key]: JSON.parse(good) },
    });
    expect(await gw.call("classify_business", classifyInput)).not.toBeNull();
    expect(client.complete).not.toHaveBeenCalled();
  });

  it("LLM_ENABLED=false makes no calls", async () => {
    const client = clientReturning(good);
    const gw = createGateway({ config: { ...config, enabled: false }, client, precomputed: {} });
    expect(await gw.call("classify_business", classifyInput)).toBeNull();
    expect(client.complete).not.toHaveBeenCalled();
  });

  it("enforces the per-IP limit", async () => {
    const client: LLMClient = { complete: async () => good };
    const gw = createGateway({ config: { ...config, hourlyPerIp: 2 }, client, precomputed: {} });
    const ask = (d: string, ip: string) => gw.call("classify_business", { description: d }, { ip });
    expect(await ask("one", "1.1.1.1")).not.toBeNull();
    expect(await ask("two", "1.1.1.1")).not.toBeNull();
    expect(await ask("three", "1.1.1.1")).toBeNull();
    expect(await ask("four", "2.2.2.2")).not.toBeNull();
  });

  it("enforces the daily cap", async () => {
    const client: LLMClient = { complete: async () => good };
    const gw = createGateway({ config: { ...config, dailyCap: 1 }, client, precomputed: {} });
    expect(await gw.call("classify_business", { description: "one" }, { ip: "a" })).not.toBeNull();
    expect(await gw.call("classify_business", { description: "two" }, { ip: "b" })).toBeNull();
  });
});

describe("guards keep the LLM to rephrasing", () => {
  const explainInput = {
    tool: { name: "Rosie", ai_capabilities: [] },
    verdict: { state: "snaps_adapter", visible: "catch", reasons: ["Updates every 15 minutes"] },
    business: { archetypes: ["field_services"], regulated: "none" },
  };

  it("rejects an explanation that invents a price", async () => {
    const client = clientReturning(
      JSON.stringify({ sentence: "It costs $99 a month." }),
      JSON.stringify({ sentence: "It costs $99 a month." }),
    );
    const gw = createGateway({ config, client, precomputed: {} });
    expect(await gw.call("explain_verdict", explainInput)).toBeNull();
  });

  it("accepts one that keeps the given numbers", async () => {
    const client = clientReturning(JSON.stringify({ sentence: "It updates every 15 minutes." }));
    const gw = createGateway({ config, client, precomputed: {} });
    expect(await gw.call("explain_verdict", explainInput)).not.toBeNull();
  });

  it("rejects reworded steps with a different count", async () => {
    const client = clientReturning(JSON.stringify({ steps: ["only one"] }), JSON.stringify({ steps: ["only one"] }));
    const gw = createGateway({ config, client, precomputed: {} });
    expect(await gw.call("personalize_steps", { tool: "x", steps: ["a", "b"], business: "y" })).toBeNull();
  });

  it("rejects map_problem ids that aren't on the board", async () => {
    const answer = JSON.stringify({ block_ids: ["made_up"], why: "w" });
    const gw = createGateway({ config, client: clientReturning(answer, answer), precomputed: {} });
    const blocks = [{ id: "reviews", name: "n", plain_name: "p", description: "d" }];
    expect(await gw.call("map_problem", { problem: "x", blocks })).toBeNull();
  });

  it("rejects an extraction whose quote isn't on the page", async () => {
    const answer = JSON.stringify({
      name: "X", vendor_url: "https://x.example", is_ai_tool: true, ai_capabilities: ["a"],
      suggested_blocks: [], suggested_archetypes: [], works_with: [], tiers: [], free_tier: false,
      evidence: [{ claim: "c", quote: "this was never on the page" }],
    });
    const gw = createGateway({ config, client: clientReturning(answer, answer), precomputed: {} });
    expect(await gw.call("extract_tool_profile", { url: "https://x.example/", page_text: "Some real page text." })).toBeNull();
  });

  it("detects new numbers", () => {
    expect(addsNewNumbers("costs $49", "price is $49")).toBe(false);
    expect(addsNewNumbers("costs $50", "price is $49")).toBe(true);
  });
});

describe("structured output schema", () => {
  it("is strict: closed objects with every field required", () => {
    const schema = jsonSchemaFor(ClassifyOutput) as { additionalProperties: boolean; required: string[] };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("archetypes");
    expect(schema.required).toContain("naics");
    expect(schema).not.toHaveProperty("$schema");
  });
});
