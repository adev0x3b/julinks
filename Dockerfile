# syntax=docker/dockerfile:1
# Three stages share one dependency install:
#   builder -> compiles the Next.js app (standalone output)
#   migrate -> one-shot container: prisma migrate deploy + demo seed
#   runner  -> the production server, nothing but the standalone bundle

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall runs `prisma generate`, which needs the schema above.
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# A placeholder URL: the build never connects, but the Prisma client needs the variable to exist.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx next build

FROM deps AS migrate
COPY prisma ./prisma
COPY src/generated ./src/generated
COPY tsconfig.json ./
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
