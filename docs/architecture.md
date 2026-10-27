# How the code is laid out

A tour for anyone who wants to change JuLinks, in the order a request travels.

## Request flow

- [`src/proxy.ts`](../src/proxy.ts) redirects dashboard requests that carry no session cookie to `/login`. It is a shortcut, not the guard: every page and action verifies the session itself.
- Pages live under [`src/app/`](../src/app/). The public page, [`src/app/[username]/page.tsx`](../src/app/[username]/page.tsx), is cached per username with `"use cache"` and a cache tag; the server actions call `updateTag` after a write, so an edit shows on the next request.
- Writes go through Server Actions in [`src/actions/`](../src/actions/). Each one reads the session, validates its input with zod ([`src/lib/validation.ts`](../src/lib/validation.ts)) and then calls the data layer. The first-run setup form is the one exception: a plain form posting to a route handler, so it works before any JavaScript and from curl.
- The data layer in [`src/lib/data/`](../src/lib/data/) is where ownership is enforced. Every mutation is scoped by `userId`, so somebody else's link id is a not-found, never a leak; `reviewRequest` re-checks the reviewer's rights inside the transaction.
- Prisma 7 with the PostgreSQL adapter; the client is generated into `src/generated/prisma` on install. [`prisma/schema.prisma`](../prisma/schema.prisma) has seven tables: `users`, `folders`, `social_links`, `links`, `clicks`, `themes` (tokens as JSON) and `setup_codes`. Image columns hold storage keys, never bytes.

## Pieces worth knowing

| Where | What |
| --- | --- |
| [`src/lib/session.ts`](../src/lib/session.ts) | Session cookie signed with `jose` (HS256), carrying the account's session version. `getCurrentUser` is memoised per request. |
| [`src/lib/roles.ts`](../src/lib/roles.ts) | Who may approve whom, as pure functions shared by the UI and the data layer. |
| [`src/lib/data/setup.ts`](../src/lib/data/setup.ts) | First-run setup: the code the migrate step prints is stored as a bcrypt hash and burnt after five wrong guesses. |
| [`src/lib/link-preview.ts`](../src/lib/link-preview.ts) | Fetching a URL the owner typed: the SSRF guard, redirect handling, size and time caps. |
| [`src/lib/images.ts`](../src/lib/images.ts), [`src/lib/storage.ts`](../src/lib/storage.ts) | The upload pipeline (`sharp`: sniff, decode, rotate, resize, strip, WebP) and the S3 client. Objects are served through [`src/app/img/[...key]/route.ts`](../src/app/img/[...key]/route.ts), which accepts only keys of the app's own shape. |
| [`src/lib/themes.ts`](../src/lib/themes.ts) | A theme is ten validated tokens. `themeStyle()` turns them into CSS custom properties, the only thing the page reads, so no user string reaches a `style` attribute. |
| [`src/lib/socials.ts`](../src/lib/socials.ts) | One table of platforms with label, placeholder, icon and a `toUrl()` that builds the link from what the owner typed. |
| [`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) | Fixed-window limiter in process memory. The interface is ready for a shared store. |
| [`src/app/globals.css`](../src/app/globals.css) | Dark mode by remapping the palette tokens under `html.dark`, so the dashboard follows without a `dark:` variant on every element. |
| [`src/components/editor/`](../src/components/editor/), [`src/components/themes/`](../src/components/themes/) | The editor and the theme studio keep a draft of the page so the preview is instant, and reset it when fresh server data arrives. Drag and drop uses `@dnd-kit`. |
| [`scripts/fake-s3.ts`](../scripts/fake-s3.ts) | The slice of the S3 API the app uses, in memory, so the test suites run without Docker. |

## Tests

- **Unit and component** (`tests/unit`, `tests/component`): validation, roles, social URLs, link preview parsing and the private-address guard, the image pipeline, the rate limiter, session tokens, deployment switches; the public page, chart and toast in jsdom.
- **Integration** (`tests/integration`): the data layer against a real PostgreSQL and bucket. Setup codes, request review rules, folders, socials, preview grabbing, ownership checks, reordering, click aggregation, theme rules, storage round trips.
- **End to end** (`e2e/`): Playwright against the production build, from first-run setup through sign-up, approval, editing, uploads, themes, the gallery, stats and password change.
- **CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): lint, types, the three suites, then a smoke test of the real compose stack that completes setup with the code from the migrate logs and follows a link to check the click lands in the database.

The README screenshots are taken by [`scripts/screenshots.ts`](../scripts/screenshots.ts) against a freshly seeded server.
