"use client";

import { Button, ButtonLink, EmptyState } from "@/components/ui";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <EmptyState title="Something didn't load">
      <p className="mb-4">Your answers are saved in this browser. Try again, or start over.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to start
        </ButtonLink>
      </div>
    </EmptyState>
  );
}
