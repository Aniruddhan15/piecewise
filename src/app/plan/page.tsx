"use client";

import { RequireProfile } from "@/modules/board/store-gate";
import { PlanView } from "@/modules/plan/plan-view";

export default function PlanPage() {
  return (
    <RequireProfile>
      <PlanView />
    </RequireProfile>
  );
}
