# JuLinks

[![CI](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml/badge.svg)](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml)

A link-in-bio service in the style of Linktree: claim a username, add links, drag them into order, pick a theme, and share one page. Every click is counted and shown on a stats page.

Built with **Next.js 16** (App Router, Cache Components, Server Actions), **React 19**, **TypeScript**, **Prisma 7** and **PostgreSQL 16**, shipped as a two-service **docker compose** stack with a self-hosted GitHub Actions pipeline.

| Editor with live preview | Public page |
| --- | --- |
| ![Editor](docs/screenshots/editor.png) | <img src="docs/screenshots/public-page.png" width="300" alt="Public page on a phone"> |

| Stats | Landing |
| --- | --- |
| ![Stats](docs/screenshots/stats.png) | ![Landing](docs/screenshots/landing.png) |

## What it does

- **Accounts**: sign up with a username, email and password; log in; log out. Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie, valid for seven days.
- **Link editor** at `/dashboard`: add, edit, enable/disable and delete links, drag-and-drop or keyboard reordering, with a phone-sized live preview that updates as you type.
- **Profile**: display name, bio and one of five themes.
- **Public page** at `/username`: server-rendered, cached per user and invalidated the moment the owner changes something.
- **Click tracking**: every link on the public page goes through `/l/:id`, which redirects and records the click (and the referrer's host, nothing more) after the response is sent.
- **Stats** at `/dashboard/stats`: totals, a 30-day daily chart, clicks per link and top referrers.

## Parts worth reading

| Where | What |
| --- | --- |
| [`src/app/[username]/page.tsx`](src/app/[username]/page.tsx) | The public page. `"use cache"` + `cacheTag` make it a cache hit per username; the server actions call `updateTag` so an edit is visible on the next request. |
| [`src/actions/links.ts`](src/actions/links.ts), [`src/actions/auth.ts`](src/actions/auth.ts) | Server Actions: the only write path. Each one re-reads the session, validates with zod, and only then touches the data layer. |
| [`src/lib/data/links.ts`](src/lib/data/links.ts) | Data access. Every mutation is scoped by `userId`, so a link id belonging to someone else is a not-found, never a leak. Reordering rejects any order that does not list the user's links exactly once. |
| [`src/lib/data/clicks.ts`](src/lib/data/clicks.ts) | Stats aggregation: two raw SQL queries for daily buckets and referrers, the rest through Prisma. |
| [`src/lib/session.ts`](src/lib/session.ts) | Session cookie with `jose` (HS256), plus `getCurrentUser`, the data-access-layer entry point memoised per request. |
| [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts) | Fixed-window limiter for login, signup and the click endpoint. In-memory, which is enough for one container; the interface is ready for a shared store. |
| [`src/components/editor/`](src/components/editor/) | Client components: the editor owns a draft of the page so the preview is instant, and resets it when fresh server data arrives. Drag and drop uses `@dnd-kit`. |
| [`src/proxy.ts`](src/proxy.ts) | Optimistic redirects (no cookie → `/login`) before any rendering. Not the guard: pages and actions verify the session themselves. |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Three tables: `users`, `links` (ordered by `position`), `clicks`. |
| [`e2e/julinks.spec.ts`](e2e/julinks.spec.ts) | The user journey end to end, including cache invalidation and keyboard reordering. |

## Running it

```bash
docker compose up --build
```

Then open <http://localhost:3000>. The `migrate` service applies the migrations and seeds a demo profile, then exits; `web` starts once it has finished.

- Demo page: <http://localhost:3000/ada>
- Demo login: `ada@example.com` / `analytical-engine`
- Change the host port with `WEB_PORT=8080 docker compose up` and set `SESSION_SECRET` for anything that is not a demo.

### Local development

```bash
cp .env.example .env            # point DATABASE_URL at a PostgreSQL 16 database
npm install                     # also generates the Prisma client
npx prisma migrate dev          # apply migrations
npm run db:seed                 # optional demo profile
npm run dev
```

## Tests

| Command | What runs | Needs |
| --- | --- | --- |
| `npm test` | Unit tests (validation, rate limiter, session tokens, reorder helper) and component tests in jsdom (public page, chart) | nothing |
| `npm run test:integration` | The data layer against a real database: uniqueness, ownership checks, reordering, click aggregation | PostgreSQL via `TEST_DATABASE_URL` |
| `npm run test:e2e` | Playwright against a production build: signup, editing, cache invalidation, click redirect and stats, keyboard reordering, auth guards | PostgreSQL via `E2E_DATABASE_URL`, `npm run build` first |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck, all three suites, and finally a smoke test of the real `docker compose` stack: it waits for `/api/health`, checks that the seeded profile is served, follows a link and verifies the click landed in the database.

> The workflow targets a self-hosted runner while the repository is private (GitHub Free shares its hosted minutes across the whole account). Before the repository goes public, switch `runs-on` back to `ubuntu-latest` and remove the runner.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Login compares against a dummy hash when the email is unknown, so timing does not reveal registered emails.
- Server Actions and route handlers never trust the client for authorisation; the session is verified on every call and every write is scoped to the owner.
- Link URLs are limited to `http(s)`; `javascript:`, `data:` and friends are rejected server-side.
- Login, signup and the click redirect are rate limited per IP; responses carry `X-Frame-Options`, `nosniff` and a referrer policy.
- Click records keep the referrer host only. No IP addresses or user agents are stored.

## Known limits

- The rate limiter and the page cache live in process memory, which fits a single container. Several replicas would need Redis for the limiter and a shared cache handler.
- An unknown username renders the not-found page with a `noindex` tag, but with a `200` status: the static shell is streamed before the lookup runs, which is how Next.js Cache Components work today.
- No email verification or password reset; no avatar upload (initials are used).

## Roadmap

- Password reset by email, custom avatars, link icons and scheduled links.
- Shared cache handler and Redis-backed rate limiting for multi-replica deployments.
- Per-link UTM parameters and CSV export of stats.
