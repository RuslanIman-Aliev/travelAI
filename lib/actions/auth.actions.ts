"use server";
import { signIn, signOut } from "@/auth";
import { cookies } from "next/headers";

const E2E_COOKIE_NAME = "e2e-auth";

/**
 * Initiates the Google login process.
 * If E2E testing authentication is enabled, sets a mock cookie instead of calling an actual provider.
 *
 * @returns {Promise<void>}
 */
export async function loginWithGoogle() {
  if (process.env.ENABLE_TEST_AUTH === "true") {
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
  if (process.env.ENABLE_TEST_AUTH === "true") {
    const cookieStore = await cookies();
    cookieStore.delete(E2E_COOKIE_NAME);
    return;
  }

  await signOut();
}
