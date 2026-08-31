import { hasSessionCookie } from "@/lib/auth-cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends anonymous visitors to the sign-in screen instead of letting each page
 * render its own dead end. Before this, `/new-trip` and `/live-guide` answered
 * with a bare line of text and no way to sign in.
 *
 * This is a redirect, not an authorisation check. It reads only whether a
 * session cookie is present, because verifying a database session needs Prisma
 * and this runs on the Edge runtime. Every page and every server action still
 * calls `auth()` or `requireUserId()` - a forged cookie gets past the redirect
 * and nothing else.
 *
 * @param {NextRequest} request - The incoming request.
 * @returns {NextResponse} The redirect, or the request passed through.
 */
export function middleware(request: NextRequest) {
  if (hasSessionCookie(request.cookies)) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/sign-in", request.url);
  // Where to land once signed in. Only the path and query survive, so this
  // cannot be turned into an open redirect to another host.
  signInUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/new-trip", "/live-guide/:path*", "/trip/:path*"],
};
