"use client";

import { use } from "react";
import { RequireProfile } from "@/modules/board/store-gate";
import { ToolStartView } from "@/modules/tool-start/tool-start-view";

export default function ToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ block?: string }>;
}) {
  const { id } = use(params);
  const { block } = use(searchParams);
  return (
    <RequireProfile>
      <ToolStartView toolId={id} blockId={block} />
    </RequireProfile>
  );
}
