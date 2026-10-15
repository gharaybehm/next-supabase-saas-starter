import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// The CSP connect-src is derived from the Supabase URL the app is built
// against, so Supabase Cloud and a self-hosted Supabase on your own domain
// both work with no edit here. Falls back to the Cloud wildcard if unset.
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return 'https://*.supabase.co wss://*.supabase.co';
  try {
    const { origin } = new URL(raw);
    return `${origin} ${origin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}`;
  } catch {
    return 'https://*.supabase.co wss://*.supabase.co';
  }
})();

const nextConfig: NextConfig = {
  // Emits .next/standalone, a self-contained server.js with only the modules
  // actually used. The Dockerfile's runner stage depends on it.
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  turbopack: {},
  async redirects() {
    return [
      {
        source: "/",
        destination: "/tenants",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/tenants",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              // AI calls are server-side only, so OpenRouter is not listed here.
              `connect-src 'self' ${supabaseOrigin}`,
              "font-src 'self'",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
