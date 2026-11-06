/**
 * Browser side of the LLM gateway. Failures return null, and callers then use their
 * deterministic fallback, so an owner never sees a raw error.
 */
export async function callTask<T>(task: string, input: unknown): Promise<T | null> {
  try {
    const res = await fetch(`/api/llm/${task}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok: boolean; data?: T };
    return body.ok && body.data ? body.data : null;
  } catch {
    return null;
  }
}
