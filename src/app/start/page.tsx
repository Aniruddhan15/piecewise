import { PageTitle } from "@/components/ui";
import { StartForm } from "@/modules/profiler/start-form";

export default function StartPage() {
  return (
    <>
      <PageTitle
        title="Tell us about your business"
        intro="This shapes every suggestion you'll see. You don't need an account."
      />
      <StartForm />
    </>
  );
}
