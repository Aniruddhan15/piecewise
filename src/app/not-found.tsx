import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState title="We couldn't find that page">
      <ButtonLink href="/" variant="secondary">
        Back to start
      </ButtonLink>
    </EmptyState>
  );
}
