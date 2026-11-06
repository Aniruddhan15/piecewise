import { createHash } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import precomputed from "@data/cache/llm.json";
import { SYSTEM_PROMPTS } from "./prompts/v1";
import { passesGuards, TASKS, type TaskId } from "./tasks";

/**
 * LLM gateway (SPEC §4, M15). Server only: the browser reaches it through the API route,
 * so the key is never sent to the client. Prompts and user text are never logged.
 *
 * Order: precomputed cache -> memory cache -> limits -> primary model -> fallback model
 * -> null, which tells the caller to use its deterministic fallback.
 */

export type LLMClient = {
  complete(args: {
    model: string;
    system: string;
    user: string;
    temperature: number;
    schemaName: string;
    jsonSchema: Record<string, unknown>;
  }): Promise<string>;
};

export type GatewayConfig = {
  enabled: boolean;
  models: { fast: string; smart: string; fallback: string };
  dailyCap: number;
  hourlyPerIp: number;
};

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    enabled: env.LLM_ENABLED !== "false" && Boolean(env.OPENROUTER_API_KEY),
    models: {
      fast: env.LLM_MODEL_FAST || "anthropic/claude-haiku-5.5",
      smart: env.LLM_MODEL_SMART || "anthropic/claude-sonnet-5.5",
      fallback: env.LLM_MODEL_FALLBACK || "openai/gpt-5-nano",
    },
    dailyCap: Number(env.LLM_DAILY_CALL_CAP) || 500,
    hourlyPerIp: 30,
  };
}

function openRouterClient(apiKey: string): LLMClient {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "X-Title": "PieceWise" },
    timeout: 20_000,
    maxRetries: 0,
  });
  return {
    async complete({ model, system, user, temperature, schemaName, jsonSchema }) {
      const response = await client.chat.completions.create({
        model,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: schemaName, strict: true, schema: jsonSchema },
        },
        // OpenRouter routes only to providers honoring structured output.
        provider: { require_parameters: true },
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
      return response.choices[0]?.message?.content ?? "";
    },
  };
}

export function cacheKey(task: TaskId, input: unknown): string {
  return createHash("sha256").update(`${task}\n${JSON.stringify(input)}`).digest("hex");
}

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export type Gateway = {
  call<T>(task: TaskId, input: unknown, opts?: { ip?: string; skipLimits?: boolean }): Promise<T | null>;
};

export function createGateway(deps: {
  config: GatewayConfig;
  client?: LLMClient;
  precomputed?: Record<string, unknown>;
  now?: () => number;
}): Gateway {
  const { config } = deps;
  const client =
    deps.client ?? (process.env.OPENROUTER_API_KEY ? openRouterClient(process.env.OPENROUTER_API_KEY) : undefined);
  const stored = deps.precomputed ?? (precomputed as Record<string, unknown>);
  const now = deps.now ?? Date.now;
  const memory = new Map<string, unknown>();
  const perIp = new Map<string, { hour: number; count: number }>();
  let day = { key: "", count: 0 };

  function withinLimits(ip: string): boolean {
    const t = now();
    const today = new Date(t).toISOString().slice(0, 10);
    if (day.key !== today) day = { key: today, count: 0 };
    if (day.count >= config.dailyCap) return false;
    const hour = Math.floor(t / 3_600_000);
    const entry = perIp.get(ip);
    if (entry && entry.hour === hour && entry.count >= config.hourlyPerIp) return false;
    perIp.set(ip, { hour, count: entry && entry.hour === hour ? entry.count + 1 : 1 });
    day.count += 1;
    return true;
  }

  async function attempt(task: TaskId, model: string, input: unknown): Promise<unknown | null> {
    const def = TASKS[task];
    try {
      const text = await client?.complete({
        model,
        system: SYSTEM_PROMPTS[task],
        user: JSON.stringify(input),
        temperature: def.temperature,
        schemaName: task,
        jsonSchema: jsonSchemaFor(def.output),
      });
      if (!text) return null;
      const parsed = def.output.safeParse(JSON.parse(text));
      if (!parsed.success) return null;
      return passesGuards(task, input, parsed.data) ? parsed.data : null;
    } catch {
      return null;
    }
  }

  return {
    async call<T>(task: TaskId, input: unknown, opts: { ip?: string; skipLimits?: boolean } = {}) {
      const key = cacheKey(task, input);
      if (key in stored) return stored[key] as T;
      if (memory.has(key)) return memory.get(key) as T;
      if (!config.enabled || !client) return null;
      if (!opts.skipLimits && !withinLimits(opts.ip ?? "unknown")) return null;

      const def = TASKS[task];
      const result =
        (await attempt(task, config.models[def.model], input)) ??
        (await attempt(task, config.models.fallback, input));
      if (result === null) return null;
      memory.set(key, result);
      return result as T;
    },
  };
}

let shared: Gateway | undefined;

/** The one gateway per server instance, so its memory cache and limits are shared. */
export function getGateway(): Gateway {
  shared ??= createGateway({ config: configFromEnv() });
  return shared;
}
