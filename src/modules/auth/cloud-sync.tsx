"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { hasProfile, parseState, useStore } from "@/modules/board/store";
import { useAuth } from "./auth-provider";
import { firestore } from "./firebase";

/**
 * Keeps a signed-in user's kit in Firestore at users/{uid}, so it follows them to any
 * device. Guests are untouched: their kit stays in this browser only.
 *
 * On sign-in: if this browser has no kit yet, the saved one is loaded. Otherwise the kit
 * on screen is what they were just working on, so it's saved to their account.
 */

export type SyncStatus = "off" | "loading" | "saving" | "saved" | "error";

const SyncContext = createContext<SyncStatus>("off");

const SAVE_DELAY_MS = 1200;

export function CloudSync({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { ready, state, load, reset } = useStore();
  const [status, setStatus] = useState<SyncStatus>("off");
  const syncedUid = useRef<string | null>(null);
  const lastSaved = useRef<string>("");
  const wasSignedIn = useRef(false);

  // Sign-in and sign-out.
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      // Signing out on a shared computer shouldn't leave the kit on screen.
      if (wasSignedIn.current) reset();
      wasSignedIn.current = false;
      syncedUid.current = null;
      return;
    }
    wasSignedIn.current = true;
    if (syncedUid.current === user.uid) return;

    let live = true;
    setStatus("loading");
    getDoc(doc(firestore(), "users", user.uid))
      .then((snap) => {
        if (!live) return;
        const raw = snap.exists() ? (snap.data().state as string | undefined) : undefined;
        const saved = raw ? parseState(JSON.parse(raw)) : null;
        if (saved && !hasProfile(state)) {
          load(saved);
          lastSaved.current = JSON.stringify(saved);
        }
        syncedUid.current = user.uid;
        setStatus("saved");
      })
      .catch(() => {
        if (live) setStatus("error");
      });
    return () => {
      live = false;
    };
    // Runs on sign-in/out only; the kit itself is saved by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.uid]);

  // Save changes, a moment after the last one.
  useEffect(() => {
    if (!user || syncedUid.current !== user.uid) return;
    const json = JSON.stringify(state);
    if (json === lastSaved.current) return;
    setStatus("saving");
    const timer = window.setTimeout(() => {
      // Stored as a JSON string: Firestore rejects undefined fields, and the kit has optional ones.
      setDoc(doc(firestore(), "users", user.uid), { state: json, updatedAt: serverTimestamp() })
        .then(() => {
          lastSaved.current = json;
          setStatus("saved");
        })
        .catch(() => setStatus("error"));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, user, status === "loading"]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SyncContext.Provider value={user ? status : "off"}>{children}</SyncContext.Provider>;
}

export function useSyncStatus(): SyncStatus {
  return useContext(SyncContext);
}
