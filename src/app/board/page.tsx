"use client";

import { PuzzleBoard } from "@/modules/board/puzzle-board";
import { RequireProfile } from "@/modules/board/store-gate";

export default function BoardPage() {
  return (
    <RequireProfile>
      <PuzzleBoard />
    </RequireProfile>
  );
}
