"use client";

import { useEffect, useState } from "react";
import { callTask } from "@/modules/llm/client-api";
import { personalizePayload } from "@/modules/llm/payloads";
import type { Tool } from "@/modules/taxonomy/types";

/** Setup steps, reworded for this business by the LLM when it's on. Same steps either way. */
export function usePersonalizedSteps(tool: Tool, description: string): string[] {
  const [steps, setSteps] = useState<string[]>(tool.setup.steps);
  useEffect(() => {
    let live = true;
    void callTask<{ steps: string[] }>(
      "personalize_steps",
      personalizePayload(tool, description),
    ).then((r) => {
      // Same number of steps, or it isn't a rewording.
      if (live && r?.steps?.length === tool.setup.steps.length) setSteps(r.steps);
    });
    return () => {
      live = false;
    };
  }, [tool, description]);
  return steps;
}
