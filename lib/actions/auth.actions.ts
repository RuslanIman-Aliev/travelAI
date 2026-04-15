"use server";
import { signIn, signOut } from "@/auth";
import { cookies } from "next/headers";

const E2E_COOKIE_NAME = "e2e-auth";

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

export async function logout() {
  if (process.env.ENABLE_TEST_AUTH === "true") {
    const cookieStore = await cookies();
    cookieStore.delete(E2E_COOKIE_NAME);
    return;
  }

  await signOut();
}
