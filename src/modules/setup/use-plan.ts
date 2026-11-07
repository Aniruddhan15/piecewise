"use client";

import { useMemo } from "react";
import { useStore } from "@/modules/board/store";
import { baseSystems, resolveAnchor } from "@/modules/compat-engine/engine";
import { kitState } from "@/modules/kit/kit";
import { buildPlan } from "@/modules/plan/build-plan";
import { catalog } from "@/modules/taxonomy/catalog";
import { overallProgress, setupSequence } from "./progress";

/** Everything the plan, setup and dashboard pages show, computed once from the kit. */
export function usePlanData() {
  const { state } = useStore();
  const { profile, pieces } = state;
  const checks = useMemo(() => state.checks ?? {}, [state.checks]);

  const plan = useMemo(() => buildPlan(profile, pieces, catalog), [profile, pieces]);
  const kit = useMemo(
    () => kitState({ profile, pieces, pains: state.suggested ?? [], skipped: state.skipped ?? [] }, catalog),
    [profile, pieces, state.suggested, state.skipped],
  );
  const sequence = useMemo(() => setupSequence(plan, profile, catalog), [plan, profile]);
  const progress = useMemo(() => overallProgress(sequence, checks), [sequence, checks]);
  const hours = sequence.reduce((sum, t) => sum + t.hours, 0);

  return {
    state,
    profile,
    plan,
    kit,
    sequence,
    checks,
    progress,
    hours,
    anchor: resolveAnchor(profile, catalog),
    base: baseSystems(profile, catalog),
  };
}
