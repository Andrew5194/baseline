FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/marketing/package.json ./apps/marketing/package.json

RUN pnpm install --frozen-lockfile --filter @baseline/marketing...

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY apps/marketing ./apps/marketing
COPY pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

ARG NEXT_PUBLIC_GITHUB_USERNAME
ENV NEXT_PUBLIC_GITHUB_USERNAME=${NEXT_PUBLIC_GITHUB_USERNAME}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter @baseline/marketing build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/marketing/public ./apps/marketing/public
COPY --from=builder /app/apps/marketing/.next/standalone ./
COPY --from=builder /app/apps/marketing/.next/static ./apps/marketing/.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/marketing/server.js"]
