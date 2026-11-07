"use client";

import { RequireProfile } from "@/modules/board/store-gate";
import { MatchesView } from "@/modules/kit/matches-view";

export default function MatchesPage() {
  return (
    <RequireProfile>
      <MatchesView />
    </RequireProfile>
  );
}
