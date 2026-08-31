"use server";

import { E2E_COOKIE_NAME, isTestAuthEnabled, signIn, signOut } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Narrows a requested post-login destination to somewhere on this site.
 *
 * The value arrives in a query string, so it is attacker-controlled: an absolute
 * URL, or a protocol-relative `//evil.example`, would turn the sign-in screen
 * into an open redirect.
 *
 * @param {unknown} value - The requested destination.
 * @returns {string} A safe in-app path, defaulting to the dashboard.
 */
const toSafeRedirect = (value: unknown): string => {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

/**
 * Initiates the Google login process.
 * If E2E testing authentication is enabled, sets a mock cookie instead of calling an actual provider.
 *
 * Accepts the submitting form's data so the sign-in screen can carry the page
 * the visitor was originally heading for. Called with no arguments - as the
 * sidebar button does - it lands on the dashboard.
 *
 * @param {FormData} [formData] - The submitting form, optionally carrying `callbackUrl`.
 * @returns {Promise<void>}
 */
export async function loginWithGoogle(formData?: FormData) {
  const redirectTo = toSafeRedirect(formData?.get("callbackUrl"));

  if (isTestAuthEnabled) {
    const cookieStore = await cookies();
    cookieStore.set(E2E_COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    // Returned, not just called: `redirect` works by throwing, and leaning on
    // that for control flow means one stray try/catch drops the e2e shortcut
    // through into a real Google sign-in.
    return redirect(redirectTo);
  }

  await signIn("google", { redirectTo });
}

/**
 * Logs the user out by invalidating their session.
 * If E2E testing authentication is enabled, deletes the mock cookie instead.
 *
 * @returns {Promise<void>}
 */
export async function logout() {
  if (isTestAuthEnabled) {
    const cookieStore = await cookies();
    cookieStore.delete(E2E_COOKIE_NAME);
    return;
  }

  await signOut();
}
