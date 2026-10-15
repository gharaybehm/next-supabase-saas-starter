# syntax=docker/dockerfile:1
#
# Production image for Coolify (or any Docker host). Relies on
# `output: 'standalone'` in next.config.ts.
#
# Node 24 (npm 11) on purpose: npm 10 and npm 11 resolve some peer conflicts
# differently, so an image whose npm major differs from the one that wrote
# package-lock.json can fail `npm ci` with EUSAGE. Keep this in step with the
# Node major you develop on (package.json "engines").

# ---- deps -------------------------------------------------------------------
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----------------------------------------------------------------
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# they must be present in this stage. In Coolify tick "Available at build time"
# for each, or the container boots healthy and every browser request fails.
#
# Nothing secret goes here. Server secrets (service-role key, Stripe, VAPID
# private key, OpenRouter, CRON_SECRET) are runtime-only: build args are kept
# in the image's layers. The build needs none of them because every external
# client is constructed on first use (utils/stripe.ts, utils/openrouter.ts,
# utils/push.ts).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

ENV NEXT_TELEMETRY_DISABLED=1
# A heap cap makes V8 collect sooner instead of pushing a small VPS into swap.
# If a build fails with "JavaScript heap out of memory", raise it.
ENV NODE_OPTIONS=--max-old-space-size=3072

RUN npm run build

# ---- runner -----------------------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# HOSTNAME=0.0.0.0 binds inside the container's own network namespace; the
# reverse proxy (Coolify's Traefik) is what faces the internet.
CMD ["node", "server.js"]
