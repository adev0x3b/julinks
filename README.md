# JuLinks

[![CI](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml/badge.svg)](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml)

A link-in-bio service in the style of Linktree: claim a username, add links with pictures, drag them into order, design your own theme (or pick one from the gallery), and share one page. Every click is counted and shown on a stats page.

Built with **Next.js 16** (App Router, Cache Components, Server Actions), **React 19**, **TypeScript**, **Prisma 7**, **PostgreSQL 16** and **SeaweedFS** (S3 API) for images, shipped as a **docker compose** stack with a self-hosted GitHub Actions pipeline.

| Theme studio with live preview | Public page |
| --- | --- |
| ![Theme studio](docs/screenshots/appearance.png) | <img src="docs/screenshots/public-page.png" width="300" alt="Public page on a phone"> |

| Link editor | Theme gallery |
| --- | --- |
| ![Editor](docs/screenshots/editor.png) | ![Gallery](docs/screenshots/gallery.png) |

| Stats | Landing |
| --- | --- |
| ![Stats](docs/screenshots/stats.png) | ![Landing](docs/screenshots/landing.png) |

## What it does

- **Accounts**: sign up with a username, email and password; log in; log out. Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie, valid for seven days.
- **Link editor** at `/dashboard`: add, edit, enable/disable and delete links, drag-and-drop or keyboard reordering, with a phone-sized live preview that updates as you type.
- **Pictures**: an avatar, a picture per link and a background image per theme. Uploads are decoded, resized, stripped of metadata and re-encoded as WebP with `sharp`, then stored in an S3 bucket (SeaweedFS in the compose stack) under a content-addressed key and served through `/img/…` with an immutable cache header.
- **Themes** at `/dashboard/appearance`: start from one of five presets, then change every colour, gradient, button style, corner radius and font, add a background image with an adjustable darkening overlay, and save it as a named theme. Several themes per account; the active one is what visitors see.
- **Theme gallery** at `/themes`: publish a theme and anyone can use it. Using one makes a copy (background image included), so creators can keep editing, unpublishing or deleting theirs without changing anybody else's page.
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
| [`src/lib/themes.ts`](src/lib/themes.ts) | A theme is ten tokens (hex colours, enum keys, one bounded number). `themeStyle()` turns them into CSS custom properties; the page only ever reads those, so no user string reaches a `style` attribute unvalidated. |
| [`src/lib/images.ts`](src/lib/images.ts), [`src/lib/storage.ts`](src/lib/storage.ts) | The upload pipeline (`sharp`: decode, rotate, resize, strip, WebP) and the S3 client (`@aws-sdk/client-s3`). SeaweedFS locally; any S3-compatible service by configuration. |
| [`src/lib/data/themes.ts`](src/lib/data/themes.ts) | Theme ownership rules: edits, publishing and deletion are owner-scoped; other people's themes are readable only when public, and only to copy. |
| [`src/app/img/[...key]/route.ts`](src/app/img/[...key]/route.ts) | Streams a stored object through the app. Only keys of the app's own shape are served. |
| [`src/lib/session.ts`](src/lib/session.ts) | Session cookie with `jose` (HS256), plus `getCurrentUser`, the data-access-layer entry point memoised per request. |
| [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts) | Fixed-window limiter for login, signup and the click endpoint. In-memory, which is enough for one container; the interface is ready for a shared store. |
| [`src/components/editor/`](src/components/editor/), [`src/components/themes/`](src/components/themes/) | Client components: the editor and the theme studio own a draft of the page so the preview is instant, and reset it when fresh server data arrives. Drag and drop uses `@dnd-kit`. |
| [`src/proxy.ts`](src/proxy.ts) | Optimistic redirects (no cookie → `/login`) before any rendering. Not the guard: pages and actions verify the session themselves. |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Four tables: `users`, `links` (ordered by `position`), `clicks`, `themes` (tokens as JSON). Image columns hold storage keys, never bytes. |
| [`scripts/fake-s3.ts`](scripts/fake-s3.ts) | The slice of the S3 API the app uses, in memory, so the integration and e2e suites run without Docker. CI and the compose stack use SeaweedFS. |
| [`e2e/julinks.spec.ts`](e2e/julinks.spec.ts) | The user journey end to end: signup, links, uploads served back as WebP, theme building, publishing and copying from the gallery, cache invalidation, reordering. |

## Running it

```bash
docker compose up --build
```

Then open <http://localhost:3000>. Four services: PostgreSQL, SeaweedFS (S3), a one-shot `migrate` container (migrations, demo profiles, demo images uploaded to the bucket) and `web`, which starts once `migrate` has finished.

- Demo pages: <http://localhost:3000/ada> and <http://localhost:3000/grace>; gallery at <http://localhost:3000/themes>
- Demo login: `ada@example.com` / `analytical-engine`
- Change the host port with `WEB_PORT=8080 docker compose up`; set `SESSION_SECRET` and `S3_SECRET_ACCESS_KEY` for anything that is not a demo.
- Pointing the app at AWS S3, Cloudflare R2 or another S3-compatible service is a matter of the `S3_*` variables (see `.env.example`).

### Local development

```bash
cp .env.example .env            # DATABASE_URL for PostgreSQL 16, S3_* for object storage
docker compose up -d db s3      # or your own PostgreSQL and S3 endpoint
npm install                     # also generates the Prisma client
npx prisma migrate dev          # apply migrations
npm run db:seed                 # optional demo profiles (uploads the demo images)
npm run dev
```

Without Docker, `npx tsx scripts/fake-s3.ts 3101` runs an in-memory S3 stand-in; point `S3_ENDPOINT` at it.

## Tests

| Command | What runs | Needs |
| --- | --- | --- |
| `npm test` | Unit tests (validation incl. theme tokens, image pipeline, rate limiter, session tokens, reorder helper) and component tests in jsdom (public page, chart) | nothing |
| `npm run test:integration` | The data layer against a real database and object storage: uniqueness, ownership checks, reordering, click aggregation, theme rules, storage round trips | PostgreSQL via `TEST_DATABASE_URL`; an S3 service via `TEST_S3_ENDPOINT`, otherwise the in-memory S3 stand-in starts itself |
| `npm run test:e2e` | Playwright against a production build: signup, editing, uploads served back as WebP, theme studio, gallery, cache invalidation, click redirect and stats, pointer reordering, auth guards | PostgreSQL via `E2E_DATABASE_URL`, `npm run build` first; an S3 service via `E2E_S3_ENDPOINT`, otherwise the stand-in |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck, all three suites (integration and e2e against a SeaweedFS container), and finally a smoke test of the real `docker compose` stack: it waits for `/api/health`, checks that the seeded profile and its avatar are served, that the gallery lists the seeded themes, follows a link and verifies the click landed in the database.

> The workflow targets a self-hosted runner while the repository is private (GitHub Free shares its hosted minutes across the whole account). Before the repository goes public, switch `runs-on` back to `ubuntu-latest` and remove the runner.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Login compares against a dummy hash when the email is unknown, so timing does not reveal registered emails.
- Server Actions and route handlers never trust the client for authorisation; the session is verified on every call and every write is scoped to the owner.
- Link URLs are limited to `http(s)`; `javascript:`, `data:` and friends are rejected server-side.
- Uploads are capped at 5 MB, must decode as PNG, JPEG, WebP or GIF, and are always re-encoded: what gets stored and served is a WebP the server produced, never the original bytes. Storage keys are generated by the app and the image route serves only keys of that shape.
- Theme tokens are validated with a strict schema (6-digit hex colours, enum values, a bounded number); the CSS the page uses is built from those, so a theme cannot smuggle `url()` or expressions into a style attribute.
- Upload actions are rate limited per user.
- Login, signup and the click redirect are rate limited per IP; responses carry `X-Frame-Options`, `nosniff` and a referrer policy.
- Click records keep the referrer host only. No IP addresses or user agents are stored.

## Known limits

- The rate limiter and the page cache live in process memory, which fits a single container. Several replicas would need Redis for the limiter and a shared cache handler.
- An unknown username renders the not-found page with a `noindex` tag, but with a `200` status: the static shell is streamed before the lookup runs, which is how Next.js Cache Components work today.
- Images are streamed through the app rather than served from the bucket or a CDN; fine for a demo, the next step at scale is signed URLs or a CDN in front of `/img/`.
- The compose stack's SeaweedFS enforces no credentials; it is reachable only from the other containers. Real deployments configure identities (`-s3.config`) or use a managed S3.
- The gallery has no moderation beyond the owner's own unpublish and delete.
- No email verification or password reset.

## Roadmap

- Password reset by email and scheduled links.
- Shared cache handler and Redis-backed rate limiting for multi-replica deployments.
- Per-link UTM parameters and CSV export of stats.
- Reporting and curation for the theme gallery.
