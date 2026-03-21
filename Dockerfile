# syntax=docker/dockerfile:1

# Next.js app `apps/web` (Turborepo prune + standalone).
# Alone: docker build -t bardak-web . && docker run -p 3000:3000 bardak-web
# With bot: docker compose up --build (see docker-compose.yml)

FROM oven/bun:1 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS pruner
COPY . .
RUN bunx turbo prune web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN bun install --frozen-lockfile

RUN bunx turbo run build --filter=web

# Runner на том же образе, что и сборка: не тянем node:*-alpine (Docker DX часто ругается на CVE в базе).
# Память: для типичного Next standalone Bun обычно сопоставим с Node; если понадобится именно Node — см. комментарий внизу.
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
# Альтернатива при несовместимости: `CMD ["node", "apps/web/server.js"]` в образе `node:22-bookworm-slim`
CMD ["bun", "apps/web/server.js"]
