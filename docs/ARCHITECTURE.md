# Architecture

Keenetix is a single Next.js 16 application that serves three surfaces from one codebase: a marketing site, an authenticated workspace, and a versioned public API. There is no separate backend service — App Router route handlers *are* the API, and Drizzle talks to Postgres directly.

```
┌────────────────────────────────────────────────────────────┐
│  Next.js App Router                                        │
│                                                            │
│  Marketing            Workspace           Public API       │
│  /  /protocol         /dashboard          /api/v1/*        │
│  /network /token      /demo               bearer keys      │
│  /marketplace         /settlement         scoped + limited │
│  /developers /docs    /sign-in /sign-up                    │
│  /brand                                                    │
│         │                   │                   │          │
│         └───────────────────┴───────────────────┘          │
│                             │                              │
│                      src/lib/keenetix.ts                   │
│              (commitment / verification / settlement)      │
│                             │                              │
│         src/lib/auth.ts           src/lib/api-security.ts  │
│         session cookies           API keys, rate limit,    │
│         workspace roles           audit log                │
│                             │                              │
│                        Drizzle ORM                         │
│                             │                              │
└─────────────────────────────┼──────────────────────────────┘
                              │
                      PostgreSQL 16
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
   EVM JSON-RPC                           Solana RPC (@solana/web3.js)
   eth_getTransactionReceipt              escrow token account + SPL USDC
```

## Layers

| Layer | Files | Responsibility |
| --- | --- | --- |
| Pages | `src/app/*/page.tsx` | Server components; mostly static marketing plus three client-driven workspace views. |
| Route handlers | `src/app/api/**/route.ts` | Session-authenticated (`/api/*`) and key-authenticated (`/api/v1/*`) endpoints. |
| Domain | `src/lib/keenetix.ts` | The only place commitment state transitions happen. |
| Auth | `src/lib/auth.ts` | Password hashing, session cookies, `getCurrentIdentity()`, workspace roles. |
| API security | `src/lib/api-security.ts` | Bearer key auth, scope checks, per-key rate limiting, audit logging. |
| Data | `src/db/schema.ts`, `src/db/index.ts` | Drizzle schema and the `pg` pool. |

## Two authentication paths

Everything that mutates state goes through exactly one of these.

**Session cookies** — browser traffic. `getCurrentIdentity()` resolves the session cookie to a user plus their *active workspace* and role. Roles are `owner | admin | builder | member | viewer`; `canManageWorkspace()` gates writes to the first three. Sessions are stored as SHA-256 hashes, never as raw tokens.

**API keys** — machine traffic on `/api/v1/*`. `authenticateApiKey(request, scope)` does five things in order:

1. Requires a `Bearer kntx_live_…` header and looks up the SHA-256 hash of the key (raw keys are never stored).
2. Rejects revoked keys and keys with no workspace binding.
3. Enforces the required scope from the key's `scopes` array — `commitments:read`, `commitments:write`, `agents:read`, `agents:write`, `verifications:write`, `settlements:write`, `audit:read`.
4. Enforces a fixed 60-second rate-limit window per key (`api_rate_limits`, default 60 req/min).
5. Writes an `api.request` row to `audit_logs` with method, path, and forwarded IP.

Every workspace-scoped query is filtered by the `workspaceId` that came from the identity, so a key can never reach another tenant's rows.

## Commitment state machine

`src/lib/keenetix.ts` owns every transition. A commitment moves forward only when the layer below it produces proof.

```
draft ──fund──► funded ──assign──► executing ──proof──► verified
                                                           │
                                            submitSettlementReceipt()
                                                           ▼
                                                 settlement_submitted
                                                           │
                                            confirmSettlementReceipt()
                                                           ▼
                                                        settled
                                                           │
                                              reputation_records written
```

- `recordVerificationOutcome()` advances `funded | executing → verified` — and *only* those, so a late or duplicate proof can't rewind a settled commitment.
- `submitSettlementReceipt()` refuses anything not in `verified | awaiting_settlement`, so value can never be released before proof.
- Settlements are upserted per commitment (latest receipt wins) rather than appended, which keeps re-submission after a dropped transaction idempotent.

## Verification

Three independent sources can produce a `verification_events` row, all converging on `recordVerificationOutcome()`:

| Source | Route | Trust mechanism |
| --- | --- | --- |
| Signed verifier | `POST /api/v1/verifications/attest` | Ed25519 `crypto.verify()` against the agent's registered `verificationPublicKey`, over the canonical JSON of the evidence. |
| Oracle | `POST /api/v1/verifications/oracle` | Scoped key plus recorded provider and evidence payload. |
| GitHub CI | `POST /api/webhooks/github` | HMAC-SHA256 `x-hub-signature-256` compared with `timingSafeEqual`; the commitment is located by a `KX-…` reference embedded in the workflow or check name. |

The webhook returns `202`-style `{ accepted: true, recorded: false }` when it can't match a commitment, so GitHub never sees a failing delivery for unrelated runs.

## Settlement

Two chains, one interface. `isValidReceipt(chain, hash, escrow, chainId)` rejects malformed receipts before any RPC call:

- **EVM** — requires a non-zero `chainId`, a 32-byte `0x…` transaction hash, and a 20-byte `0x…` escrow address.
- **Solana** — requires a base58 signature (64–90 chars) and a base58 escrow *token account* (32–44 chars).

Confirmation is a two-step handshake rather than a single write: the client submits a receipt (`/api/settlements/submit`), then polls confirmation (`/api/settlements/confirm`), which reads the transaction back from `EVM_RPC_URL` or `SOLANA_RPC_URL` and only then marks the settlement `settled` and writes reputation. The app never holds keys or signs — wallets sign in the browser (`src/components/wallet-settlement-console.tsx`, `solana-settlement-console.tsx`) and the server verifies on chain.

## Data model

Fourteen tables in three clusters.

**Identity** — `users`, `oauth_accounts`, `sessions`, `organizations`, `organization_memberships`, `workspaces`, `workspace_memberships`. Workspaces are the tenancy boundary; organizations group them.

**Execution** — `agents`, `commitments`, `commitment_bids`, `verification_events`, `verification_integrations`, `settlements`, `reputation_records`, `disputes`.

**Platform** — `developer_accounts` (legacy, retained for data compatibility), `api_keys`, `api_rate_limits`, `audit_logs`, `access_requests`.

Money is `numeric(14,2)` throughout — never a float. All timestamps are `withTimezone`. Schema changes are applied with `drizzle-kit push --force`, wired to `prestart` so a deploy migrates before it serves.

## Frontend motion system

The site has no animation library. Two mechanisms cover everything:

- **`src/components/ascii-motion.tsx`** — a single global client component. One `IntersectionObserver` reveals elements matching a selector list with a stepped `ascii-drop` / `ascii-wipe` animation, staggered by a `--ascii-i` custom property. A debounced `MutationObserver` rescans after client-rendered content mounts. Headings deliberately opt out into a softer `minimal-rise`.
- **`src/components/ascii-field.tsx`** — animated ASCII backdrops (`wave`, `pulse`, `rain`, `scan`, `drift`). A `requestAnimationFrame` loop mutates `textContent` and `style.opacity` on child spans directly, bypassing React re-render, throttled to ~22fps and paused when off-screen or when the tab is hidden. The first frame is computed deterministically in `useMemo` at `t=0` so server and client markup match.

Both check `prefers-reduced-motion` and bail out to a static frame. Fields are placed at `z-index: -1` inside parents with `isolation: isolate`, so they sit behind content without reordering markup.

## Testing and CI

`tests/` runs against a real Postgres — `tests/setup.ts` loads `.env` and stubs `next/headers` with a fake cookie store, so auth and settlement logic are exercised end to end rather than mocked.

`.github/workflows/ci.yml` boots a `postgres:16-alpine` service, then runs `drizzle-kit push` → `typecheck` → `lint` → `test` → `build` → `redocly lint public/openapi.yaml`. The OpenAPI lint is what keeps the published contract honest. On green pushes to `main`, a `deploy` job ships to Railway; Vercel deploys independently through its Git integration.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `EVM_RPC_URL` | settlement | JSON-RPC endpoint used to confirm EVM receipts. |
| `SOLANA_RPC_URL` | settlement | RPC endpoint used to confirm Solana signatures. |
| `GITHUB_WEBHOOK_SECRET` | CI proof | HMAC secret for the GitHub webhook. |
| `NEXT_PUBLIC_KEENETIX_CHAIN_ID` | client | Chain the wallet console targets. |
| `NEXT_PUBLIC_KEENETIX_ESCROW_ADDRESS` | client | EVM escrow contract. |
| `NEXT_PUBLIC_USDC_ADDRESS` | client | EVM USDC token. |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | client | Solana RPC for the browser console. |
| `NEXT_PUBLIC_SOLANA_ESCROW_TOKEN_ACCOUNT` | client | Solana escrow token account. |
| `NEXT_PUBLIC_SOLANA_USDC_MINT` | client | SPL USDC mint. |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical origin. Defaults to `https://www.keenetix.xyz`. |
| `NEXT_PUBLIC_AHREFS_ANALYTICS_KEY` | no | Ahrefs Web Analytics key. The script only renders when set. |
| `NEXT_PUBLIC_AHREFS_SITE_VERIFICATION` | no | Ahrefs verification token. |

## Metadata and SEO

`src/lib/site.ts` is the single source of truth: `ROUTES` carries the title, description, sitemap priority, and change frequency for every indexable page, and `PRIVATE_PATHS` lists what must never be indexed. Three consumers read from it, so a new page is described once.

| Consumer | Output |
| --- | --- |
| `pageMetadata(path)` in each page | Title, description, canonical, Open Graph, Twitter card |
| `src/app/sitemap.ts` | `/sitemap.xml` |
| `src/app/robots.ts` | `/robots.txt`, including an explicit `AhrefsBot` / `AhrefsSiteAudit` group |

`privateMetadata()` stamps `noindex, nofollow, nocache` on `/dashboard`, `/settlement`, `/sign-in`, and `/sign-up`.

The root layout adds a JSON-LD `@graph` (`Organization` + `WebSite` + `SoftwareApplication`, cross-referenced by `@id`), the keyword set, `googleBot` directives with `max-image-preview:large`, theme colours for both schemes, and — only when `NEXT_PUBLIC_AHREFS_ANALYTICS_KEY` is set — the Ahrefs analytics script via `next/script` with `afterInteractive`.

Icons use Next file conventions in `src/app/`: `favicon.ico` (16/32/48 RGBA PNGs in an ICO container), `icon.svg`, and `apple-icon.png` (180×180, square — iOS applies its own mask). These cascade to every route. PWA icons (192, 512, and a 512 maskable with the artwork inset to the 80% safe zone) live in `public/icons/` and are wired through `src/app/manifest.ts`. The 1200×630 social card sits at `public/og-image.png` rather than as a route-segment file, because file-convention `opengraph-image` applies only to its own segment and would not reach child routes.

## Design notes

**Why no separate API service?** The domain logic is small and transactional. Route handlers keep the deploy surface to one artifact, and both auth paths funnel into the same `src/lib/keenetix.ts` functions, so there is exactly one implementation of each state transition.

**Why hash-only key and session storage?** A database dump yields no usable credential. Keys are shown once at creation and matched by SHA-256 thereafter; `key_prefix` exists purely so the UI can display which key is which.

**Why audit everything at the security layer?** Putting `logAudit()` inside `authenticateApiKey()` rather than in each handler means a new endpoint is audited by construction, not by remembering to add a line.
