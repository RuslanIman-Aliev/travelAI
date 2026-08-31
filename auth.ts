import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { cache } from "react";
import { E2E_COOKIE_NAME } from "./lib/auth-cookies";
import { UserFacingError } from "./lib/errors";
import { prisma } from "./prisma";

/**
 * The e2e sign-in shortcut below hands out a real session to anyone holding a
 * cookie, so it is gated on the build as well as the env var. A stray
 * `ENABLE_TEST_AUTH=true` in a production environment must not be enough to
 * open the app.
 */
export const isTestAuthEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_TEST_AUTH === "true";

// Re-exported so existing imports keep working; the constant lives in a leaf
// module because `middleware.ts` needs it without pulling in Prisma.
export { E2E_COOKIE_NAME };

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(!isTestAuthEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(isTestAuthEnabled
      ? [
          Credentials({
            name: "E2E Test Login",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              const email = String(
                credentials?.email ??
                  process.env.E2E_TEST_EMAIL ??
                  "e2e@travel-ai.local",
              );
              const name = String(
                credentials?.name ?? process.env.E2E_TEST_NAME ?? "E2E User",
              );

              const user = await prisma.user.upsert({
                where: { email },
                update: { name },
                create: { email, name, emailVerified: new Date() },
              });

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
              };
            },
          }),
        ]
      : []),
  ],
  secret: process.env.NEXTAUTH_SECRET,
});

const authBase = nextAuth.auth;
export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

/**
 * Resolves the current session.
 *
 * Wrapped in React `cache` so the several server components and actions that
 * each need the session during one render share a single database lookup
 * instead of issuing one `Session` query apiece.
 *
 * @returns {Promise<Session|null>} The active session, or null when signed out.
 */
export const auth = cache(async (): Promise<Session | null> => {
  if (isTestAuthEnabled) {
    const cookieStore = await cookies();
    const hasTestAuthCookie = cookieStore.get(E2E_COOKIE_NAME)?.value === "1";

    if (hasTestAuthCookie) {
      const email = process.env.E2E_TEST_EMAIL ?? "e2e@travel-ai.local";
      const name = process.env.E2E_TEST_NAME ?? "E2E User";

      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: { email, name, emailVerified: new Date() },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as Session;
    }
  }

  return (await authBase()) as Session | null;
});

/**
 * Resolves the current user's id, or throws when unauthenticated.
 * Shared by every action that needs an owner for a query.
 *
 * @returns {Promise<string>} The authenticated user's id.
 * @throws {Error} `Unauthorized` when there is no valid session.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UserFacingError("Unauthorized");
  }

  return session.user.id;
}
