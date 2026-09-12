import type { NextConfig } from "next";
import path from "node:path";

/**
 * Where the Nest API actually lives. Server-side only - the browser never sees
 * this host, and must not: it talks to `/backend` on this origin and lets the
 * rewrite below forward the request.
 */
const NEST_API_URL = process.env.NEST_API_URL ?? "http://localhost:3001";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile above this directory otherwise
  // makes Turbopack infer the wrong one.
  turbopack: {
    root: path.join(__dirname),
  },
  /**
   * Proxies the API through this origin.
   *
   * The session cookie is `SameSite=Lax`, so a browser will not send it to a
   * different site - and `vercel.app` is a public suffix, which makes every
   * deployment its own site. Calling the API directly from the browser would
   * therefore arrive unauthenticated no matter how CORS is configured.
   *
   * Routed through here, every request is same-origin: the cookie is attached
   * automatically, there is no preflight, and the API's host stays private.
   * The cost is one extra hop through a serverless function per call.
   */
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${NEST_API_URL}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
