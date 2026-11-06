"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { decodeState, demoState, useStore } from "./store";

/** Loads a demo or a shared plan from the URL, on first load or after in-app navigation. */
export function UrlStateLoader() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { ready, load } = useStore();
  const demo = params.get("demo");
  const shared = params.get("s");

  useEffect(() => {
    if (!ready || (!demo && !shared)) return;
    const next = (demo && demoState(demo)) || (shared && decodeState(shared));
    if (next) load(next);
    router.replace(pathname);
  }, [ready, demo, shared, load, router, pathname]);

  return null;
}
