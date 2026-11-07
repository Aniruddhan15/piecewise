"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase is optional. These values are public by design (they identify the project,
 * they don't grant access); Firestore security rules decide who can read what.
 * Next.js only inlines NEXT_PUBLIC_ variables when they're written out in full.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Without config the app runs exactly as before: no sign-in button, no cloud saving. */
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | undefined;

function firebaseApp(): FirebaseApp {
  if (!firebaseEnabled) throw new Error("Firebase isn't configured");
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firestore(): Firestore {
  return getFirestore(firebaseApp());
}
