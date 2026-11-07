"use client";

import { use } from "react";
import { RequireProfile } from "@/modules/board/store-gate";
import { SetupView } from "@/modules/setup/setup-view";

export default function SetupPage({ searchParams }: { searchParams: Promise<{ tool?: string }> }) {
  const { tool } = use(searchParams);
  return (
    <RequireProfile>
      <SetupView toolId={tool} />
    </RequireProfile>
  );
}
