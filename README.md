# JuLinks

[![CI](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml/badge.svg)](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml)

A link-in-bio service in the style of Linktree: claim a username, add links with pictures (uploaded, or grabbed from the link itself), group them in folders, put your social icons under a multi-line bio, drag everything into order, design your own theme (or pick one from the gallery), and share one page. Every click is counted and shown on a stats page. Invite only: a sign-up is a request that an admin or moderator approves with a role, or denies. The dashboard has a light and a dark mode.

Built with **Next.js 16** (App Router, Cache Components, Server Actions), **React 19**, **TypeScript**, **Prisma 7**, **PostgreSQL 16** and **SeaweedFS** (S3 API) for images, shipped as a **docker compose** stack with a GitHub Actions pipeline.

| Theme studio with live preview | Public page |
| --- | --- |
| ![Theme studio](docs/screenshots/appearance.png) | <img src="docs/screenshots/public-page.png" width="300" alt="Public page on a phone"> <img src="docs/screenshots/folder-open.png" width="300" alt="A collapsed folder, opened"> |

| Link editor | Theme gallery |
| --- | --- |
| ![Editor](docs/screenshots/editor.png) | ![Gallery](docs/screenshots/gallery.png) |

| Stats | Landing |
| --- | --- |
| ![Stats](docs/screenshots/stats.png) | ![Landing](docs/screenshots/landing.png) |

| Sign-up requests (admin) | Denied at login |
| --- | --- |
| ![Requests](docs/screenshots/requests.png) | ![Denied toast](docs/screenshots/login-denied.png) |

| Editor in dark mode: folders, social icons, picture from the link |
| --- |
| ![Editor, dark](docs/screenshots/editor-dark.png) |

## What it does

- **Invite-only accounts**: asking for a page (username, email, password) stores a *request*; nobody can log in until it is approved. The first real account on a fresh install is approved on the spot and becomes the admin (the seeded demo profiles do not count, are plain clients and never show up as requests). Admins and moderators get a **Requests** page in the dashboard with the number waiting in the nav: approve with a role (`client`, `moderator` or `admin`) or deny. A pending or denied requester sees a toast at login saying so, but only with the right password, so the login form cannot be used to find out who has asked. Decisions can be revisited: a denied request approved later, an approved account revoked (its session and public page go away at once) or given another role. Moderators only make clients and cannot touch moderators or admins; nobody reviews themselves. Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie, valid for seven days.
- **Link editor** at `/dashboard`: add, edit, enable/disable and delete links, drag-and-drop or keyboard reordering, with a phone-sized live preview that updates as you type.
- **Bio and social icons**: the bio keeps its line breaks (a row of emoji under the text stays under it on a phone instead of wrapping into it), and a row of icons under it links to up to twelve platforms (Instagram, TikTok, X, Threads, Bluesky, Mastodon, YouTube, Twitch, Facebook, LinkedIn, GitHub, Pinterest, Snapchat, Spotify, Telegram, WhatsApp, Discord, Substack, Medium, Patreon, Ko-fi, Buy Me a Coffee, email, website). You type a handle, a number, an address or a URL; the app builds the link (`@june` on Mastodon as `@june@server`, a phone number as a `wa.me` link, and so on). Brand icons come from [simple-icons](https://simpleicons.org).
- **Folders**: group links under a title. An open folder shows as a headed section; a collapsed one as a row that expands on tap into one box holding its links as plain rows (a native `<details>`, so it works without JavaScript). Links are moved between folders from their row; deleting a folder sends its links back to the main list.
- **Picture from the link**: a link's picture can be uploaded or grabbed from the page it points to (`og:image`, `twitter:image` or `image_src`). Adding a link tries this on its own, after the response; the picture panel has a button for it. The fetch is SSRF-guarded (see Security notes).
- **Dark mode**: a toggle in the header, remembered in the browser, with the system setting as the default and no flash of the wrong colour on load. Public pages are unaffected: they draw every colour from their theme.
- **Pictures**: an avatar, a picture per link and a background image per theme. A link's picture shows either small beside the title or big above it, like a card, and both it and the avatar can be centred on any point: click the picture (or drag) and the page crops around that point with `object-fit`, so nothing is thrown away at upload time. Uploads are decoded, resized, stripped of metadata and re-encoded as WebP with `sharp`, then stored in an S3 bucket (SeaweedFS in the compose stack) under a content-addressed key and served through `/img/…` with an immutable cache header.
- **Themes** at `/dashboard/appearance`: start from one of five presets, then change every colour, gradient, button style, corner radius and font, add a background image with an adjustable darkening overlay, and save it as a named theme. Several themes per account; the active one is what visitors see.
- **Theme gallery** at `/themes`: publish a theme and anyone can use it. Using one makes a copy (background image included), so creators can keep editing, unpublishing or deleting theirs without changing anybody else's page.
- **Public page** at `/username`: server-rendered, cached per user and invalidated the moment the owner changes something.
- **Click tracking**: every link on the public page goes through `/l/:id`, which redirects and records the click (and the referrer's host, nothing more) after the response is sent.
- **Stats** at `/dashboard/stats`: totals, a 30-day daily chart, clicks per link and top referrers.
- **Account** at `/dashboard/account`: change the password (the current one is required); every other device is logged out, the one making the change stays in.

## Parts worth reading

| Where | What |
| --- | --- |
| [`src/app/[username]/page.tsx`](src/app/[username]/page.tsx) | The public page. `"use cache"` + `cacheTag` make it a cache hit per username; the server actions call `updateTag` so an edit is visible on the next request. |
| [`src/actions/links.ts`](src/actions/links.ts), [`src/actions/auth.ts`](src/actions/auth.ts) | Server Actions: the only write path. Each one re-reads the session, validates with zod, and only then touches the data layer. |
| [`src/lib/link-preview.ts`](src/lib/link-preview.ts) | Fetching a URL the owner typed, done carefully: the private-address check runs inside the connection's own DNS lookup (no check-then-connect gap), IP literals are checked up front, each redirect hop is re-checked, bodies and time are capped, and the image goes through the same resize/re-encode path as an upload. |
| [`src/lib/socials.ts`](src/lib/socials.ts) | One table of platforms: label, placeholder, icon path and a `toUrl()` that turns what the owner typed into the link. The validation schema, the editor and the public page all read it. |
| [`src/app/globals.css`](src/app/globals.css) | Dark mode without a `dark:` class on every element: the palette tokens Tailwind utilities read are remapped under `html.dark` (stone scale mirrored, status colours swapped), so the whole dashboard follows. |
| [`src/lib/roles.ts`](src/lib/roles.ts), [`src/lib/data/requests.ts`](src/lib/data/requests.ts) | Who may approve whom, as pure functions the UI and the data layer share; `reviewRequest` checks them again inside the transaction, so the buttons the page hides cannot be reached with a hand-made request either. |
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
| [`e2e/julinks.spec.ts`](e2e/julinks.spec.ts) | The user journey end to end: sign-up request, approval and denial, links, uploads served back as WebP, theme building, publishing and copying from the gallery, cache invalidation, reordering. |

## Running it

```bash
cp .env.example .env
docker compose up --build
```

Then open <http://localhost:3000>. (`.env` holds the session secret; the placeholder in `.env.example` works on localhost only.) Four services: PostgreSQL, SeaweedFS (S3), a one-shot `migrate` container (migrations, demo profiles, demo images uploaded to the bucket) and `web`, which starts once `migrate` has finished.

- Demo pages: <http://localhost:3000/ada> and <http://localhost:3000/grace>; gallery at <http://localhost:3000/themes>
- Demo login: `ada@example.com` / `analytical-engine` (a plain client, like every demo profile)
- Your own account: the first one you create is approved and made admin automatically, and its **Requests** page is where later sign-ups get approved or denied.
- Change the host port with `WEB_PORT=8080` in `.env`. The port is published on `127.0.0.1` only (`WEB_BIND=0.0.0.0` for the LAN).
- Pointing the app at AWS S3, Cloudflare R2 or another S3-compatible service is a matter of the `S3_*` variables (see `.env.example`).

### Putting it on the internet

The compose defaults suit a laptop. Before the app answers to a real hostname, in `.env`:

1. `SESSION_SECRET`: the output of `openssl rand -base64 48`. The app refuses the placeholders everybody knows once `APP_URL` is not localhost. Changing it logs every browser out once.
2. `APP_URL`: the public `https://` address. Session cookies are `Secure` in production, so plain `http://` on anything but localhost cannot log in; terminate TLS in front (Cloudflare Tunnel, Caddy, nginx).
3. `TRUST_PROXY`: `cloudflare` behind a Cloudflare Tunnel, `1` behind nginx/Caddy/Traefik, so the per-IP rate limits key on the visitor and not on the proxy. Only safe when nothing but that proxy can reach port 3000, which is why compose publishes it on `127.0.0.1`.
4. `ALLOW_DEMO_LOGIN=0`: the demo profiles stay visible, but nobody can log in as `ada` and rewrite the showcase.
5. `FIRST_ADMIN_EMAIL`: your own address, so the first admin seat cannot be grabbed by whoever finds the site first (moot once you have an admin).
6. `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: real credentials, configured on the storage side too, or point `S3_*` at a managed bucket. Inside the compose network the bucket is not published, so this matters when the storage is.

Then `docker compose up --build -d`; migrations apply on start, nothing is wiped. `db`, `s3` and `web` carry `restart: unless-stopped`, so once Docker itself starts with the machine the site comes back after a reboot with no further command (`docker compose down` still stops it for good).

**Cloudflare Tunnel** (what the author runs): `cloudflared` on the same machine points at `http://localhost:3000`, so the stack is reachable only through Cloudflare. Settings worth turning on in the Cloudflare dashboard: *Always Use HTTPS* and a minimum TLS version of 1.2 (SSL/TLS → Edge Certificates), *Bot Fight Mode* (Security → Bots), and one rate-limiting rule on `/login` and `/signup` (Security → WAF → Rate limiting rules; the free plan includes one). Optionally put a Zero Trust Access policy in front of `/dashboard` so only your own email can reach the editor at all; the public pages stay public.

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
| `npm test` | Unit tests (validation incl. theme tokens, bio lines, socials and review decisions; roles; social platform URLs; link preview parsing and the private-address guard against a local server; image pipeline; rate limiter; session tokens incl. versions and the demo-secret guard; client address behind a proxy; deployment switches; reorder helper) and component tests in jsdom (public page incl. folders and icons, chart, toast) | nothing |
| `npm run test:integration` | The data layer against a real database and object storage: first-account bootstrap incl. `FIRST_ADMIN_EMAIL`, the pending-request cap, password change, request review rules, folders, socials, grabbing a preview image from a local page into storage, uniqueness, ownership checks, reordering, click aggregation, theme rules, storage round trips | PostgreSQL via `TEST_DATABASE_URL`; an S3 service via `TEST_S3_ENDPOINT`, otherwise the in-memory S3 stand-in starts itself |
| `npm run test:e2e` | Playwright against a production build: sign-up request, approval and denial, editing, bio lines, social icons, folders (open and collapsed), preview image grabbed from a link, dark mode, uploads served back as WebP with the small/big layout and focal point, theme studio, gallery, cache invalidation, click redirect and stats, pointer reordering, auth guards, password change logging the other device out | PostgreSQL via `E2E_DATABASE_URL`, `npm run build` first; an S3 service via `E2E_S3_ENDPOINT`, otherwise the stand-in |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck, all three suites (integration and e2e against a SeaweedFS container), and finally a smoke test of the real `docker compose` stack: it waits for `/api/health`, checks that the seeded profile and its avatar are served, that the gallery lists the seeded themes, follows a link and verifies the click landed in the database.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Login compares against a dummy hash when the email is unknown, so timing does not reveal registered emails; whether a request is pending or denied is revealed only after the password matched.
- Review rights are enforced in the data layer inside the same transaction that reads the target's role, not only in the UI; the first-account bootstrap runs serializable so two simultaneous first sign-ups cannot both become admin. Demo profiles, whose passwords are public, can never be admins.
- Server Actions and route handlers never trust the client for authorisation; the session is verified on every call and every write is scoped to the owner.
- Link URLs are limited to `http(s)`; `javascript:`, `data:` and friends are rejected server-side.
- Uploads are capped at 5 MB, must be PNG, JPEG, WebP or GIF by their first bytes, and are always re-encoded: what gets stored and served is a WebP the server produced, never the original bytes. Every other libvips decoder (SVG/librsvg, AVIF/libheif, PDF, TIFF, JPEG 2000, ...) is switched off in `sharp` for the whole process, so a crafted file in one of those formats never reaches a parser; the October 2026 librsvg and August 2026 libheif remote-code-execution bugs were in exactly those decoders. Next's own Image Optimization endpoint is disabled (`images.unoptimized`), as the app never uses it. Storage keys are generated by the app and the image route serves only keys of that shape.
- Theme tokens are validated with a strict schema (6-digit hex colours, enum values, a bounded number); the CSS the page uses is built from those, so a theme cannot smuggle `url()` or expressions into a style attribute.
- Upload actions are rate limited per user.
- Wrong login guesses are limited twice: per IP (10 per 15 minutes) and per account (20 per hour), so neither spoofing `X-Forwarded-For` nor spreading guesses over many addresses gets around it; a right password never spends either budget, so a household behind one address is not locked out and a guesser cannot lock the owner out. Sign-ups and the click redirect are limited per IP, and the sign-up form stops taking requests once 100 are waiting, so the table cannot be filled from the outside.
- Sessions carry the account's session version; changing the password bumps it, which invalidates every other device's cookie at once. The compose demo `SESSION_SECRET` is refused as soon as `APP_URL` leaves localhost, and the demo profiles' logins can be switched off (`ALLOW_DEMO_LOGIN=0`). `FIRST_ADMIN_EMAIL` keeps the first admin seat for one address.
- Every response carries a Content Security Policy (`default-src 'self'`, no third-party origins, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`), `Strict-Transport-Security`, `X-Frame-Options`, `nosniff`, a referrer policy, a permissions policy and `Cross-Origin-Opener-Policy`. The policy allows inline scripts and styles: a nonce-based one would force every page to render per request and lose the cached public pages, and the app embeds no third-party code, which is what nonces protect against.
- Click records keep the referrer host only. No IP addresses or user agents are stored.
- "Grab from the link" makes the server fetch a URL the owner typed. Only `http(s)`; hostnames must resolve to public addresses, checked inside the socket's DNS lookup so a rebinding between check and connect cannot slip through; IP literals and every redirect hop are checked the same way; pages are capped at 1 MB and images at 8 MB with an 8 s deadline; the downloaded bytes are re-encoded by `sharp` like any upload, never served as received. Tests set `LINK_PREVIEW_ALLOW_PRIVATE=1` to reach local servers; production never does.
- The framework is kept on patched releases: `next`, `react` and `sharp` are pinned in the lockfile at versions past the October 2026 security update (`use cache` RCE, SVG RCE, Server Actions DoS) and the December 2025 React Server Components RCE ("React2Shell"), and Dependabot opens a weekly PR for the next ones. The server has no `eval`, `child_process` or raw SQL built from input (`$queryRaw` is used once, as a tagged template, for the health check), and the container runs as an unprivileged user.
- Social icon URLs are built by the app from a validated handle, address or URL (`http(s)` and `mailto:` only), so a profile cannot link to a `javascript:` scheme.

## Known limits

- The rate limiter and the page cache live in process memory, which fits a single container. Several replicas would need Redis for the limiter and a shared cache handler.
- Whether a username or email is taken is visible on the sign-up form; the alternative (sending an email) needs mail delivery the app does not have.
- An unknown username renders the not-found page with a `noindex` tag, but with a `200` status: the static shell is streamed before the lookup runs, which is how Next.js Cache Components work today.
- Images are streamed through the app rather than served from the bucket or a CDN; fine for a demo, the next step at scale is signed URLs or a CDN in front of `/img/`.
- The compose stack's SeaweedFS enforces no credentials; it is reachable only from the other containers. Real deployments configure identities (`-s3.config`) or use a managed S3.
- The gallery has no moderation beyond the owner's own unpublish and delete.
- No email verification or password reset, and no email when a request is approved or denied: requesters find out at login.

## Roadmap

- Password reset by email and scheduled links.
- Shared cache handler and Redis-backed rate limiting for multi-replica deployments.
- Per-link UTM parameters and CSV export of stats.
- Reporting and curation for the theme gallery.

## About

JuLinks is a portfolio project by Andrea Cracchiolo, built with [Claude Code](https://claude.com/claude-code) as a pair programmer: the product, the stack, the security decisions and the review of every change are mine. MIT licensed, see [LICENSE](LICENSE).
