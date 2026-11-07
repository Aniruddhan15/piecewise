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
        <p className="mb-4">It takes two taps, or you can open an example business.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/">Pick my business</ButtonLink>
        </div>
      </EmptyState>
    );
  }
  return <>{children}</>;
}
