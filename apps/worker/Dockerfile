# Yagura worker — poller + alert engine + Telegram bot.
# Build from the REPO ROOT (the monorepo context is required):
#   docker build -f apps/worker/Dockerfile -t yagura-worker .
#
# Runs anywhere a small container runs (Railway, Fly.io, a $5 VPS).
# Configure via YAGURA_* environment variables — see .env.example.

FROM node:24-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

# ── Build stage: install everything, compile core + worker ───────────────
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @yagura/worker...
COPY packages/core packages/core
COPY apps/worker apps/worker
RUN pnpm --filter @yagura/core build && pnpm --filter @yagura/worker build

# ── Runtime stage: production deps + built output only ───────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --prod --filter @yagura/worker... \
  && pnpm store prune
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/core/drizzle packages/core/drizzle
COPY --from=build /app/apps/worker/dist apps/worker/dist

# The worker owns database migrations and applies them on boot.
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
