/**
 * Form checks for sign-up and account changes. They run as the user types, so problems
 * show before anything is sent. Firebase checks again on its side.
 */

export const MIN_PASSWORD = 8;

export type Check = { label: string; ok: boolean };

export function passwordChecks(password: string): Check[] {
  return [
    { label: `At least ${MIN_PASSWORD} characters`, ok: password.length >= MIN_PASSWORD },
    { label: "At least one letter", ok: /[A-Za-z]/.test(password) },
    { label: "At least one number", ok: /\d/.test(password) },
  ];
}

export function passwordOk(password: string): boolean {
  return passwordChecks(password).every((c) => c.ok);
}

/** A practical check: something@something.something, with no spaces. */
export function emailOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function emailError(email: string): string | null {
  if (!email.trim()) return "Enter your email address.";
  if (!emailOk(email)) return "That doesn't look like an email address. Check for typos.";
  return null;
}

export function nameError(name: string): string | null {
  if (!name.trim()) return "Enter your name, or your business name.";
  if (name.trim().length > 60) return "Keep it under 60 characters.";
  return null;
}

export function confirmError(password: string, confirm: string): string | null {
  if (!confirm) return "Type your password again.";
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}
