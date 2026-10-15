"use client";

// Last-resort backstop for failures in the root layout itself, which
// app/error.tsx cannot reach. It replaces the root layout, so there is no
// NextIntlClientProvider, no font variables and no guarantee that globals.css
// loaded: hence its own <html>/<body>, inline styles and English-only copy.
// Keep it dependency-free; a boundary that throws is worse than none.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "28rem",
            padding: "1.5rem",
            textAlign: "center",
            border: "1px solid #e2e8f0",
            borderRadius: "1rem",
            backgroundColor: "#ffffff",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>The app couldn&apos;t load</h2>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#475569" }}>
            Something went wrong while starting the app. Try again; if it keeps happening, reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.625rem 1rem",
              border: "none",
              borderRadius: "0.5rem",
              backgroundColor: "#16a34a",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ margin: "1rem 0 0", fontSize: "11px", fontFamily: "ui-monospace, monospace", color: "#94a3b8" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
