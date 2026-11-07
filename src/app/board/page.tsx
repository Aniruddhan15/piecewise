"use client";

import { RequireProfile } from "@/modules/board/store-gate";
import { EverythingView } from "@/modules/kit/everything-view";

export default function BoardPage() {
  return (
    <RequireProfile>
      <EverythingView />
    </RequireProfile>
  );
}
