FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/metrics/package.json ./packages/metrics/package.json
COPY packages/integrations/github/package.json ./packages/integrations/github/package.json

RUN pnpm install --frozen-lockfile --filter @baseline/api...

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY packages/metrics ./packages/metrics
COPY packages/integrations/github ./packages/integrations/github
COPY tsconfig.base.json turbo.json ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter @baseline/api build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/api/.next/standalone ./
COPY --from=builder /app/apps/api/.next/static ./apps/api/.next/static
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/api/server.js"]
