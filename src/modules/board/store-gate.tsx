"use client";

import type { ReactNode } from "react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { hasProfile, useStore } from "./store";

/** Waits for saved state, and sends people without a profile back to the start. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const { ready, state } = useStore();
  if (!ready) {
    return (
      <p role="status" className="text-ink-2">
        Loading your business…
      </p>
    );
  }
  if (!hasProfile(state)) {
    return (
      <EmptyState title="Tell us about your business first">
        <p className="mb-4">It takes about a minute, or you can look at a demo business.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/start">Describe my business</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            See demo businesses
          </ButtonLink>
        </div>
      </EmptyState>
    );
  }
  return <>{children}</>;
}
