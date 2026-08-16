"use server";

import { E2E_COOKIE_NAME, isTestAuthEnabled, signIn, signOut } from "@/auth";
import { cookies } from "next/headers";

/**
 * Initiates the Google login process.
 * If E2E testing authentication is enabled, sets a mock cookie instead of calling an actual provider.
 *
 * @returns {Promise<void>}
 */
export async function loginWithGoogle() {
  if (isTestAuthEnabled) {
    const cookieStore = await cookies();
    cookieStore.set(E2E_COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return;
  }

  await signIn("google");
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
