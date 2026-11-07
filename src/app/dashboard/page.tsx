"use client";

import { RequireProfile } from "@/modules/board/store-gate";
import { DashboardView } from "@/modules/setup/dashboard-view";

export default function DashboardPage() {
  return (
    <RequireProfile>
      <DashboardView />
    </RequireProfile>
  );
}
