"use client";

import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseAuth, firebaseEnabled } from "./firebase";

export type AuthUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
  emailVerified: boolean;
  /** True if they can sign in with a password (so password changes apply). */
  hasPassword: boolean;
  /** True if they signed in with Google. */
  hasGoogle: boolean;
};

type Auth = {
  enabled: boolean;
  /** False until Firebase has told us whether someone is signed in. */
  ready: boolean;
  user: AuthUser | null;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Re-reads the account, for example after they click the verification link. */
  refresh: () => Promise<void>;
  changeName: (name: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  /** Sends a confirmation link to the new address; the change happens when they click it. */
  changeEmail: (newEmail: string, currentPassword?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

function toUser(u: User): AuthUser {
  const providers = u.providerData.map((p) => p.providerId);
  return {
    uid: u.uid,
    name: u.displayName,
    email: u.email,
    photo: u.photoURL,
    emailVerified: u.emailVerified,
    hasPassword: providers.includes("password"),
    hasGoogle: providers.includes("google.com"),
  };
}

/** Firebase error codes, in words an owner can act on. Null means say nothing. */
export function authMessage(error: unknown): string | null {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
    case "auth/invalid-email":
      return "That email address doesn't look right. Check it and try again.";
    case "auth/email-already-in-use":
      return "There's already an account with this email. Try signing in, or reset your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. Check them, or reset your password.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a stronger password: at least 8 characters, with a letter and a number.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes, or reset your password.";
    case "auth/requires-recent-login":
      return "For your safety, sign out and back in, then try again.";
    case "auth/operation-not-allowed":
      return "This way of signing in isn't switched on yet. (Setup: turn it on in Firebase Authentication.)";
    case "auth/unauthorized-domain":
      return "Sign-in isn't allowed from this web address yet. (Setup: add it under Firebase Authentication, Authorized domains.)";
    case "auth/network-request-failed":
      return "We couldn't reach the sign-in service. Check your internet connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) return;
    return onAuthStateChanged(firebaseAuth(), (u) => {
      setUser(u ? toUser(u) : null);
      setReady(true);
    });
  }, []);

  const current = () => {
    const u = firebaseAuth().currentUser;
    if (!u) throw Object.assign(new Error("Not signed in"), { code: "auth/requires-recent-login" });
    return u;
  };

  const refresh = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (!u) return;
    await reload(u);
    setUser(toUser(u));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { user: u } = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    await updateProfile(u, { displayName: name.trim() });
    setUser(toUser(u));
    await sendEmailVerification(u, { url: `${window.location.origin}/account` });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(firebaseAuth(), provider);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth(), email.trim(), { url: `${window.location.origin}/login` });
  }, []);

  const resendVerification = useCallback(async () => {
    await sendEmailVerification(current(), { url: `${window.location.origin}/account` });
  }, []);

  const changeName = useCallback(async (name: string) => {
    const u = current();
    await updateProfile(u, { displayName: name.trim() });
    setUser(toUser(u));
  }, []);

  /** Sensitive changes need a fresh sign-in: we ask for the password, or Google again. */
  const reauth = async (u: User, password?: string) => {
    if (password && u.email) {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
    } else {
      await reauthenticateWithPopup(u, new GoogleAuthProvider());
    }
  };

  const changePassword = useCallback(async (currentPassword: string, next: string) => {
    const u = current();
    await reauth(u, currentPassword);
    await updatePassword(u, next);
  }, []);

  const changeEmail = useCallback(async (newEmail: string, currentPassword?: string) => {
    const u = current();
    await reauth(u, currentPassword);
    await verifyBeforeUpdateEmail(u, newEmail.trim(), { url: `${window.location.origin}/login` });
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth());
  }, []);

  const value = useMemo(
    () => ({
      enabled: firebaseEnabled,
      ready,
      user,
      signUp,
      signIn,
      signInWithGoogle,
      resetPassword,
      resendVerification,
      refresh,
      changeName,
      changePassword,
      changeEmail,
      signOut,
    }),
    [ready, user, signUp, signIn, signInWithGoogle, resetPassword, resendVerification, refresh, changeName, changePassword, changeEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
