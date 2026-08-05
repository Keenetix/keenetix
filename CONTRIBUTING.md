# Contributing to Keenetix

Thanks for taking the time. This document covers what you need to get productive and what a reviewable pull request looks like here.

## Setup

Requires Node 22+ and PostgreSQL 16.

```bash
npm ci
cp .env.example .env          # fill in DATABASE_URL
npx drizzle-kit push --force  # create the schema
npm run dev
```

Tests run against a **real** database, not a mock — `tests/setup.ts` loads `.env`. Point `DATABASE_URL` at a scratch database before running `npm run test`; the suite writes and cleans up rows.

## Before you open a PR

Run what CI runs, in the same order:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npx @redocly/cli lint public/openapi.yaml
```

All five are required to merge. The OpenAPI lint catches contract drift, so if you touched an `/api/v1/*` route, update [`public/openapi.yaml`](public/openapi.yaml) in the same PR.

## Conventions

**Domain logic lives in `src/lib/keenetix.ts`.** Route handlers parse and validate input, then call a domain function. Do not perform commitment state transitions inline in a route — both the session path and the API-key path must reach the same implementation.

**Never trust a client-supplied workspace id.** Scope every query by the `workspaceId` returned from `getCurrentIdentity()` or `authenticateApiKey()`. This is the tenancy boundary.

**New `/api/v1/*` routes must go through `authenticateApiKey(request, scope)`** with the narrowest scope that fits. Audit logging is handled there — don't reimplement it per route.

**Money is `numeric`, never a float.** Timestamps are always `withTimezone`.

**Schema changes** go in `src/db/schema.ts` and are applied with `drizzle-kit push`. There is no migration folder; `prestart` pushes on deploy. Additive changes are safe — flag anything destructive in the PR description.

**Style.** Match the file you're editing. This codebase favours dense single-line JSX for presentational markup and reserves multi-line formatting for logic. `src/app/globals.css` is intentionally compact; append new work in readable blocks at the end rather than reformatting existing rules.

**Motion.** Anything animated must respect `prefers-reduced-motion` and must not animate during hydration in a way that breaks SSR markup matching. See the motion section of [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commits and pull requests

- Branch from `main`. `main` is protected and deploys on merge.
- Write imperative commit subjects: `Add oracle verification scope`, not `added scopes`.
- Keep the diff to one concern. A refactor and a behaviour change in one PR is two PRs.
- Fill in the PR template — reviewers rely on the verification section.

## Reporting bugs and requesting features

Open an issue using the templates. For anything with a security impact, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.
