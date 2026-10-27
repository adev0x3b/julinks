# JuLinks

[![CI](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml/badge.svg)](https://github.com/adev0x3b/julinks/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

A self-hosted link-in-bio page, in the spirit of Linktree. One page per user with links, pictures, folders and social icons, a theme studio, click stats, and invite-only sign-up. Runs as a single `docker compose` stack.

Live at [links.juume.site](https://links.juume.site).

<p align="center">
  <img src="docs/screenshots/public-page.png" width="260" alt="A public page on a phone">
  <img src="docs/screenshots/folder-open.png" width="260" alt="A collapsed folder, opened">
</p>

![The link editor with its live preview](docs/screenshots/editor.png)

<details>
<summary>More screenshots</summary>

| Theme studio | Theme gallery |
| --- | --- |
| ![Theme studio](docs/screenshots/appearance.png) | ![Theme gallery](docs/screenshots/gallery.png) |

| Stats | Landing page |
| --- | --- |
| ![Stats](docs/screenshots/stats.png) | ![Landing page](docs/screenshots/landing.png) |

| Sign-up requests | Denied at login |
| --- | --- |
| ![Sign-up requests](docs/screenshots/requests.png) | ![The toast a denied requester sees](docs/screenshots/login-denied.png) |

![Editor in dark mode](docs/screenshots/editor-dark.png)

</details>

## Features

- **Links** with drag-and-drop ordering, on/off switches and a live phone-sized preview.
- **Pictures** for links and the avatar: upload one, or grab the link's own `og:image`. Pick the focal point, show it small beside the title or big like a card.
- **Folders**, open as a headed section or collapsed as a row that expands on tap.
- **Bio and social icons** for 24 platforms. Type a handle, the app builds the URL.
- **Themes**: five presets, every colour, gradient, button style, radius and font adjustable, a background image with overlay. Publish a theme to the gallery and anyone can copy it.
- **Stats**: totals, a 30-day chart, clicks per link, top referrers.
- **Invite only**: a sign-up is a request that an admin or moderator approves, with a role, or denies.
- **First-run setup**: a fresh install serves nothing until the admin account is created with a one-time code printed by `docker compose up`.
- **Dark mode** in the dashboard. Public pages take every colour from their theme.

## Quick start

```bash
git clone https://github.com/adev0x3b/julinks.git && cd julinks
cp .env.example .env
docker compose up --build
```

The first start prints a **setup code**. Open <http://localhost:3000/setup>, enter it and create the admin account. From then on the site is live.

- Demo pages: [/ada](http://localhost:3000/ada), [/grace](http://localhost:3000/grace), gallery at [/themes](http://localhost:3000/themes).
- Demo login: `ada@example.com` / `analytical-engine`.
- Lost the code? `docker compose run --rm --no-deps migrate npm run setup-code` prints a new one. Five wrong guesses void a code too.

The stack is PostgreSQL, SeaweedFS (S3 API) for images, a one-shot `migrate` container (migrations and demo data) and the app on port 3000, published on `127.0.0.1` only. Migrations are additive, so `git pull && docker compose up --build -d` is the whole upgrade.

## Configuration

Everything is read from `.env` (see [`.env.example`](.env.example) for the comments).

| Variable | Default | What it does |
| --- | --- | --- |
| `SESSION_SECRET` | placeholder | Signs session cookies. The placeholder only works on localhost; use `openssl rand -base64 48`. |
| `APP_URL` | `http://localhost:3000` | Public address, used for absolute URLs and the secret check above. |
| `WEB_PORT`, `WEB_BIND` | `3000`, `127.0.0.1` | Where compose publishes the app. `WEB_BIND=0.0.0.0` opens it to the LAN. |
| `TRUST_PROXY` | unset | `cloudflare` behind a Cloudflare Tunnel, `1` behind nginx, Caddy or Traefik: keys rate limits on the visitor's address. |
| `ALLOW_DEMO_LOGIN` | `1` | Set `0` on a public site so nobody logs in as the demo profiles. |
| `S3_*` | the compose SeaweedFS | Any S3-compatible service works, AWS S3 and Cloudflare R2 included. |

### Exposing it to the internet

1. Set a real `SESSION_SECRET`, `APP_URL` with `https://`, `TRUST_PROXY` for your proxy and `ALLOW_DEMO_LOGIN=0`.
2. Put TLS in front: a Cloudflare Tunnel, Caddy or nginx on the same machine pointing at `http://localhost:3000`.
3. Complete `/setup` before sharing the address.

Then `docker compose up --build -d`. The services restart with Docker, so a reboot brings the site back on its own. The security details behind these steps are in [docs/security.md](docs/security.md).

## Development

```bash
cp .env.example .env
docker compose up -d db s3      # PostgreSQL and SeaweedFS, or bring your own
npm install
npx prisma migrate dev
npm run db:seed                 # demo profiles, optional
npm run dev
```

Without Docker, `npx tsx scripts/fake-s3.ts 3101` is an in-memory S3 stand-in; point `S3_ENDPOINT` at it.

Built with Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript, Tailwind, Prisma 7 and PostgreSQL 16; images go through `sharp` into an S3 bucket. [docs/architecture.md](docs/architecture.md) walks through the code.

## Tests

| Command | Runs | Needs |
| --- | --- | --- |
| `npm test` | Unit and component tests | nothing |
| `npm run test:integration` | The data layer against a real database and bucket | PostgreSQL (`TEST_DATABASE_URL`); the S3 stand-in starts itself |
| `npm run test:e2e` | Playwright against a production build | PostgreSQL (`E2E_DATABASE_URL`), `npm run build` first |

CI runs lint, types, the three suites and a smoke test of the real compose stack, setup code included.

## Security

- bcrypt passwords, signed `httpOnly` cookies, a session version that logs other devices out on password change.
- Every write goes through a Server Action that verifies the session and scopes the query to the owner.
- Rate limits per IP and per account on login, per IP on sign-up and clicks, per user on uploads.
- Uploads are sniffed, capped at 5 MB and re-encoded to WebP; only the PNG, JPEG, WebP and GIF decoders are enabled.
- Fetching a link's preview image is guarded against SSRF: public addresses only, checked at DNS and socket level, every redirect hop included.
- A strict CSP, HSTS and the usual headers on every response. Weekly Dependabot.

More in [docs/security.md](docs/security.md).

## Limits

- The rate limiter and the page cache live in process memory, which fits one container. Several replicas would need Redis and a shared cache handler.
- No password reset or email of any kind: requesters find out at login whether they were approved.
- Images are streamed through the app, not from a CDN.

## About

I'm Andrea Cracchiolo. JuLinks is my project; I built it with [Claude Code](https://claude.com/claude-code) as a pair programmer and reviewed every change. MIT licensed, see [LICENSE](LICENSE).
