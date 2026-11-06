"use client";

import { use } from "react";
import { RequireProfile } from "@/modules/board/store-gate";
import { BlockView } from "@/modules/matcher/block-view";

export default function BlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireProfile>
      <BlockView blockId={id} />
    </RequireProfile>
  );
}
