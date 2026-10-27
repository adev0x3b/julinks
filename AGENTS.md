# Working on JuLinks

Read [README.md](README.md) first: it says what the app does, how the parts fit and how the tests run. Conventions that matter when changing code:

- Commits go straight to `main` and every push must keep `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` and `npm run test:e2e` green (see [docs/architecture.md](docs/architecture.md) for what each suite needs).
- Database changes are additive migrations under `prisma/migrations`: the compose stack runs `prisma migrate deploy` against real data on every start.
- Anything that fetches, decodes or stores user-supplied content goes through the existing guards (`src/lib/link-preview.ts`, `src/lib/images.ts`, `src/lib/storage.ts`); [docs/security.md](docs/security.md) explains why each exists.
- Every user action gives visible feedback (a toast, an inline error or a disabled state), in light and dark mode and at phone width.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
