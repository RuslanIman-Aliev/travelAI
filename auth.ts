import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const isTestAuthEnabled = process.env.ENABLE_TEST_AUTH === "true";
const E2E_COOKIE_NAME = "e2e-auth";

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
                create: {
                  email,
                  name,
                  emailVerified: new Date(),
                },
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

export async function auth(...args: any[]) {
  if (isTestAuthEnabled && args.length === 0) {
    const cookieStore = await cookies();
    const hasTestAuthCookie = cookieStore.get(E2E_COOKIE_NAME)?.value === "1";

    if (hasTestAuthCookie) {
      const email = process.env.E2E_TEST_EMAIL ?? "e2e@travel-ai.local";
      const name = process.env.E2E_TEST_NAME ?? "E2E User";

      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: {
          email,
          name,
          emailVerified: new Date(),
        },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  }

  return (authBase as (...innerArgs: any[]) => Promise<unknown>)(...args);
}
