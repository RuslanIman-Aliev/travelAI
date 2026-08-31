"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last resort: this catches errors thrown by the root layout itself, so it
 * replaces `<html>`/`<body>` and cannot rely on anything the layout provides -
 * no theme provider, no sidebar, no fonts. Deliberately plain for that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
          <h1 className="text-2xl font-bold">Travel AI is having a problem</h1>
          <p className="max-w-md text-sm opacity-70">
            The application failed to start. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-md border px-6 text-sm font-medium"
          >
            Reload
          </button>
          {error.digest && (
            <p className="text-xs opacity-60">Reference: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
