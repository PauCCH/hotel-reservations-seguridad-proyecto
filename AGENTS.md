# AGENTS.md

## Purpose
- This file gives AI agents and contributors a consistent operating guide.
- Keep instructions concise; defer to README and CONTRIBUTING for detail.

## Security course project (read first)
- This repo is the target of the IC-8071 Seguridad del Software final project (4 modules, 4 members).
- Progress, next steps and per-member work routes live in `docs/proyecto-seguridad/plan-desarrollo.md`.
- When a user starts a session by identifying themselves (e.g. "Soy Paula"), read that file and follow
  its §0 "Protocolo de inicio de sesión" before doing anything else.
- Members: Paula (Autenticación), Joseph (Gestión de Usuarios), Aarón (Operaciones/Transacciones),
  Fabian (Logs/Auditoría).

## Repo summary
- Monorepo with Turborepo + pnpm workspaces.
- Apps: `apps/landing`, `apps/portal-reservas`, `apps/panel-admin`.
- Shared packages: `packages/core`, `packages/db`, `packages/i18n`, `packages/ui`.

## Ports
- `apps/landing` runs on :3000
- `apps/portal-reservas` runs on :3001
- `apps/panel-admin` runs on :3002

## Environment
- Node.js >= 20
- pnpm 10 (repo uses `pnpm@9.15.4` in `package.json` `packageManager`)
- Copy `.env.example` to `.env.local` and fill required secrets

## Install
```bash
pnpm install
```

## Dev workflows
- Run all apps: `pnpm dev`
- Run a single app:
  - `pnpm --filter @hotel/landing dev`
  - `pnpm --filter @hotel/portal-reservas dev`
  - `pnpm --filter @hotel/panel-admin dev`

## Build
- All packages and apps: `pnpm build`
- Single app:
  - `pnpm --filter @hotel/landing build`
  - `pnpm --filter @hotel/portal-reservas build`
  - `pnpm --filter @hotel/panel-admin build`

## Lint and format
- Lint (repo): `pnpm lint`
- Auto-fix: `pnpm lint:fix`
- Format: `pnpm format`
- Per app/package: `pnpm --filter @hotel/landing lint`

## Type checking
- Repo: `pnpm type-check`
- Per app/package: `pnpm --filter @hotel/portal-reservas type-check`

## Tests
- Vitest is available in `apps/portal-reservas` and `apps/panel-admin`.
- Run all tests in an app (no root test script):
  - `pnpm --filter @hotel/portal-reservas vitest`
  - `pnpm --filter @hotel/panel-admin vitest`
- Run a single test file:
  - `pnpm --filter @hotel/portal-reservas vitest path/to/test.ts`
- Run a single test by name:
  - `pnpm --filter @hotel/portal-reservas vitest -t "test name"`

## Database and Supabase (packages/db)
- Generate types: `pnpm --filter @hotel/db db:types`
- Push schema: `pnpm --filter @hotel/db db:push`
- New migration: `pnpm --filter @hotel/db db:migration`

## Workspace filters
- Use `pnpm --filter @hotel/<name> <script>` for scoped work.
- Common filters:
  - `@hotel/landing`
  - `@hotel/portal-reservas`
  - `@hotel/panel-admin`
  - `@hotel/core`
  - `@hotel/db`
  - `@hotel/i18n`
  - `@hotel/ui`

## Code style conventions
- TypeScript everywhere; prefer explicit types for public APIs.
- Formatting and linting via Biome; do not add ESLint or Prettier configs.
- Use `@hotel/*` workspace imports for shared modules.
- Keep files and folders lowercase with dashes when creating new paths.
- Avoid deep relative imports; prefer package exports.

## UI conventions
- Next.js 15 + React 19 in all apps.
- Tailwind CSS v4 for styling; keep utility classes readable and grouped.
- HeroUI v3 components in `portal-reservas` and `panel-admin`.
- Shared UI lives in `packages/ui`.

## Monorepo conventions
- Turborepo orchestrates builds and type-checks.
- Prefer workspace dependencies (`workspace:*`) for internal packages.
- Keep package `scripts` consistent across apps when possible.

## Dependency management
- Add new dependencies at the package/app that uses them.
- Use `pnpm add -F @hotel/<name> <pkg>` for scoped installs.
- Avoid adding dependencies at the root unless shared across workspaces.

## Environment variables
- Do not commit secrets to git.
- Keep `.env.local` out of version control.
- Update `.env.example` when introducing new required variables.

## Git and PRs
- Commit messages follow Conventional Commits.
- See `CONTRIBUTING.md` for branch and PR expectations.

## Editor and tooling notes
- No Cursor rules found (no `.cursor/` or `.cursorrules` files).
- No GitHub Copilot rules found (no `.github/copilot*` files).

## When adding new scripts
- Add to root `package.json` if it applies to multiple apps.
- Add to app/package `package.json` if it is scoped.
- Keep `pnpm` commands consistent with existing naming.

## Troubleshooting
- Clean caches: `pnpm clean`
- If a single app is stuck, run `pnpm --filter <app> clean` then reinstall.

## References
- `README.md` for stack and setup details.
- `GOOD_PRACTICES.md` for team conventions.
- `CONTRIBUTING.md` for contribution rules.
