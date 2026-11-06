import { NextResponse, type NextRequest } from "next/server";
import { getGateway } from "@/modules/llm/gateway";
import { PUBLIC_TASKS, TASKS, type TaskId } from "@/modules/llm/tasks";

/**
 * Browser entry to the LLM gateway. A failure is `{ ok: false }` with a 200, never a raw
 * error: the client then uses its deterministic fallback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ task: string }> },
) {
  const { task } = await params;
  if (!PUBLIC_TASKS.has(task as TaskId)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const id = task as TaskId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const input = TASKS[id].input.safeParse(body);
  if (!input.success) return NextResponse.json({ ok: false }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const data = await getGateway().call(id, input.data, { ip });
  return NextResponse.json(data === null ? { ok: false } : { ok: true, data });
}
