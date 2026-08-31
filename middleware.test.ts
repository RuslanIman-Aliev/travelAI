import { config, middleware } from "@/middleware";
import { NextRequest } from "next/server";

const requestTo = (path: string, cookies: Record<string, string> = {}) => {
  const request = new NextRequest(new URL(path, "https://travel.example.com"));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
};

describe("middleware", () => {
  it("sends an anonymous visitor to the sign-in screen", () => {
    const response = middleware(requestTo("/new-trip"));

    const location = new URL(response.headers.get("location") ?? "");
    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/sign-in");
  });

  it("carries the page the visitor was heading for", () => {
    const response = middleware(
      requestTo("/trip/clx0000000000000000000000?day=2"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("callbackUrl")).toBe(
      "/trip/clx0000000000000000000000?day=2",
    );
  });

  it.each([
    ["the Auth.js cookie", "authjs.session-token"],
    ["the secure Auth.js cookie", "__Secure-authjs.session-token"],
    ["the e2e cookie", "e2e-auth"],
  ])("lets a request through carrying %s", (_label, cookieName) => {
    const response = middleware(requestTo("/new-trip", { [cookieName]: "1" }));

    expect(response.headers.get("location")).toBeNull();
  });

  // Presence, not validity - Prisma cannot run on the Edge runtime, so the
  // session is verified by the page, not here. Worth pinning so nobody mistakes
  // this for the authorisation check.
  it("does not attempt to validate the cookie", () => {
    const response = middleware(
      requestTo("/new-trip", { "authjs.session-token": "obviously-forged" }),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  // The matcher, not the function, is what decides which paths are guarded at
  // all - a page dropped from this list is silently public.
  it("guards the planner, Live Guide and every trip page", () => {
    expect(config.matcher).toEqual([
      "/new-trip",
      "/live-guide/:path*",
      "/trip/:path*",
    ]);
  });
});
