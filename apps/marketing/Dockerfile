# Multi-stage build for optimized production image
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace config and lockfile from repo root
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/marketing/package.json ./apps/marketing/package.json

# Install dependencies for apps/marketing only
RUN pnpm install --frozen-lockfile --filter @baseline/marketing...

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/marketing/node_modules ./apps/marketing/node_modules
COPY apps/marketing ./apps/marketing
COPY pnpm-workspace.yaml package.json turbo.json ./

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN pnpm --filter @baseline/marketing build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from the standalone output
COPY --from=builder /app/apps/marketing/public ./public
COPY --from=builder /app/apps/marketing/.next/standalone ./
COPY --from=builder /app/apps/marketing/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the application
CMD ["node", "server.js"]
