"use client";

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { BusinessProfileSchema } from "@/modules/taxonomy/schemas";
import { catalog, demos } from "@/modules/taxonomy/catalog";
import type { BusinessProfile, Tool } from "@/modules/taxonomy/types";

/**
 * App state lives in the browser and in shareable URLs (P8: no login).
 * The profile holds only business questions, never customer or patient data (P6).
 */

const STORAGE_KEY = "piecewise:v1";

const SavedSchema = z.object({
  profile: BusinessProfileSchema,
  pieces: z.record(z.string(), z.string()),
  demoId: z.string().optional(),
  suggested: z.array(z.string()).optional(),
});

export type AppState = z.infer<typeof SavedSchema>;

export const emptyProfile: BusinessProfile = {
  description: "",
  archetypes: [],
  employees: 0,
  locations: 1,
  mobile: false,
  base: { channels: [] },
  selected_tiers: {},
  devices: [],
  connectivity: "reliable",
  regulated: "none",
  sells_on: [],
};

const emptyState: AppState = { profile: emptyProfile, pieces: {} };

export function encodeState(state: AppState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeState(encoded: string): AppState | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const result = SavedSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Storage can throw in private windows or when site data is blocked. */
function readStorage(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = SavedSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function writeStorage(state: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The app still works for this visit; only reload persistence is lost.
  }
}

export function demoState(id: string): AppState | null {
  const demo = demos.find((d) => d.id === id);
  if (!demo) return null;
  return { profile: structuredClone(demo.profile), pieces: { ...demo.pieces }, demoId: id };
}

type Store = {
  ready: boolean;
  state: AppState;
  setProfile: (update: (p: BusinessProfile) => BusinessProfile) => void;
  setPiece: (blockId: string, toolId: string | null) => void;
  setSuggested: (ids: string[]) => void;
  load: (next: AppState) => void;
  reset: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  // Client-only sources win over the server render: URL first, then this browser's save.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const fromDemo = params.get("demo");
    const fromShare = params.get("s");
    const initial =
      (fromDemo && demoState(fromDemo)) || (fromShare && decodeState(fromShare)) || readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state after hydration
    if (initial) setState(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeStorage(state);
  }, [state, ready]);

  const setProfile = useCallback((update: (p: BusinessProfile) => BusinessProfile) => {
    setState((s) => ({ ...s, profile: update(s.profile) }));
  }, []);

  const setPiece = useCallback((blockId: string, toolId: string | null) => {
    setState((s) => {
      const pieces = { ...s.pieces };
      if (toolId) pieces[blockId] = toolId;
      else delete pieces[blockId];
      return { ...s, pieces };
    });
  }, []);

  const setSuggested = useCallback((ids: string[]) => {
    setState((s) => ({ ...s, suggested: ids }));
  }, []);

  const load = useCallback((next: AppState) => setState(next), []);

  const reset = useCallback(() => {
    setState(emptyState);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  const value = useMemo(
    () => ({ ready, state, setProfile, setPiece, setSuggested, load, reset }),
    [ready, state, setProfile, setPiece, setSuggested, load, reset],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

/** Tools currently placed on the board. */
export function chosenTools(pieces: Record<string, string>): Tool[] {
  const tools: Tool[] = [];
  for (const id of new Set(Object.values(pieces))) {
    const tool = catalog.byId.get(id);
    if (tool) tools.push(tool);
  }
  return tools;
}

/** Has this business answered enough to show a board? */
export function hasProfile(state: AppState): boolean {
  return state.profile.archetypes.length > 0;
}
