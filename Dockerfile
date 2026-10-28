# syntax=docker/dockerfile:1
# Three stages share one dependency install:
#   builder -> compiles the Next.js app (standalone output)
#   migrate -> one-shot container: prisma migrate deploy + demo seed (uploads the demo images)
#   runner  -> the production server, nothing but the standalone bundle

# Debian for the stages that run the Prisma CLI: `prisma migrate` still uses a native
# schema engine that needs OpenSSL, and `npm ci` downloads the matching build.
FROM node:26-bookworm-slim AS deps
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall runs `prisma generate`, which needs the schema above.
RUN npm ci --no-audit --no-fund

FROM deps AS builder
# .dockerignore keeps a host's node_modules and src/generated out, so the client generated
# by `npm ci` above (matching this image's OS) is the one that gets built.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Pages without request data (landing, login) are rendered here, so absolute URLs in their
# metadata (og:image) take APP_URL from the build: compose passes the one in .env.
ARG APP_URL
# A placeholder URL: the build never connects, but the Prisma client needs the variable to exist.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx next build

# The generated Prisma client is already in the deps stage: `npm ci` ran `prisma generate`.
FROM deps AS migrate
COPY tsconfig.json ./
# The seed uses the app's image pipeline and storage client (src/lib) to upload the demo pictures;
# the setup-code script makes a new code for /setup (`docker compose run --rm --no-deps migrate npm run setup-code`).
COPY src ./src
COPY scripts/setup-code.ts ./scripts/
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# The server: the standalone bundle only. Same Debian base as the install, so the sharp
# (libvips) binary that npm picked for glibc is the one that runs.
FROM node:26-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system app && useradd --system --gid app --home /app app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.js"]
