## What this changes

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why

<!-- The problem this solves. Link the issue if there is one: Closes #123 -->

## How

<!-- Notable implementation decisions, and anything a reviewer would otherwise have to reverse-engineer. -->

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npx @redocly/cli lint public/openapi.yaml` (if any `/api/v1/*` route changed)

<!-- If you tested manually, say exactly what you did. Screenshots for UI changes. -->

## Impact

- [ ] Changes the database schema (`src/db/schema.ts`)
- [ ] Changes the published API contract (`public/openapi.yaml`)
- [ ] Touches auth, scopes, or workspace isolation
- [ ] Touches commitment state transitions or settlement
- [ ] Requires a new environment variable (documented in `.env.example`)
- [ ] None of the above

<!-- Anything checked above: explain the migration or rollout path below. -->
