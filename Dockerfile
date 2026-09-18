# Production Dockerfile for Kisan-Mitra
FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*


# -------------------------
# Dependencies
# -------------------------
FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci


# -------------------------
# Build
# -------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build


# -------------------------
# Production runner
# -------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV ALLOW_IN_MEMORY_DB_FALLBACK=false

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs kisan

COPY --from=builder --chown=kisan:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=kisan:nodejs /app/package.json ./package.json
COPY --from=builder --chown=kisan:nodejs /app/prisma ./prisma
COPY --from=builder --chown=kisan:nodejs /app/.next ./.next
COPY --from=builder --chown=kisan:nodejs /app/public ./public
COPY --from=builder --chown=kisan:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=kisan:nodejs /app/backend ./backend
COPY --from=builder --chown=kisan:nodejs /app/lib ./lib
COPY --from=builder --chown=kisan:nodejs /app/services ./services
COPY --from=builder --chown=kisan:nodejs /app/tsconfig.json ./tsconfig.json

USER kisan

EXPOSE 3000

CMD ["npm", "start"]