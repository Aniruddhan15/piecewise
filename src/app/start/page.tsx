import { redirect } from "next/navigation";

/** The old long form: the two-tap finder on the home page replaces it. */
export default function StartPage() {
  redirect("/");
}
