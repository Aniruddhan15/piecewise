"use client";

import { PageTitle } from "@/components/ui";
import { BaseForm } from "@/modules/intake/base-form";
import { RequireProfile } from "@/modules/board/store-gate";

export default function BasePage() {
  return (
    <RequireProfile>
      <PageTitle
        title="What do you already use?"
        intro="Keeping what you have usually beats buying something new. These four answers decide which tools can fit."
      />
      <BaseForm />
    </RequireProfile>
  );
}
