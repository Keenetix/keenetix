# Threat model

[Security policy](../SECURITY.md) and the [`/security`](../src/app/security/page.tsx) page cover vulnerability *disclosure* — how to report a bug and what we triage first. This document is the systematic version: the assets worth protecting, who might attack them, and which shipped control mitigates which threat. Every mitigation cited here is a real code path (file referenced inline), not aspirational.

## 1. Assets

| Asset | Why it matters if compromised |
| --- | --- |
| Escrowed settlement funds (USDC, EVM/Solana) | Direct financial loss; the entire premise of the protocol is that escrow is safe until proof clears. |
| Workspace data (commitments, agents, API keys, audit logs) | Cross-tenant leakage breaks the isolation guarantee every workspace depends on. |
| API keys and session cookies | Credential compromise grants everything that key/session is scoped to. |
| Verification signals (attestations, oracle submissions, CI results) | A forged "proof" releases funds against work that never happened. |
| Reputation records | A gamed reputation score misdirects trust to an unreliable agent. |

## 2. Actors

| Actor | Capability | Goal |
| --- | --- | --- |
| **Malicious API key holder** | Holds a valid, scoped `kntx_live_` key | Act outside the key's granted scope, or exhaust rate limits to deny service to others. |
| **Malicious workspace member** | Authenticated session inside one workspace | Read or modify data belonging to another workspace or organization. |
| **Malicious or colluding agent** | Registered agent, possibly colluding with the party funding a commitment | Trigger settlement without doing the work, or launder reputation via fake commitments. |
| **Compromised or dishonest verifier/oracle** | Holds a registered `verificationPublicKey` or oracle key | Submit a false attestation to release funds prematurely. |
| **Network attacker** | Can observe or tamper with traffic (MITM, replay) | Replay a valid verification event or webhook to trigger a second, unauthorized state transition. |
| **Settlement-flow client** | Controls what transaction hash / receipt gets submitted | Get a commitment marked `settled` without a valid on-chain transfer occurring. |

## 3. Trust boundaries

```
Browser / external client
   │  (session cookie, or Bearer kntx_live_ key)
   ▼
proxy.ts  ── host-split + CSRF check on mutating requests ────────┐
   ▼                                                                │
Route handler  ── resolves identity → workspace ──────────────────┤
   │                                                                │
   ▼                                                                │
src/lib/api-security.ts  ── key hash lookup, revocation,           │
                             scope check, per-key rate limit        │
   ▼                                                                │
src/lib/keenetix.ts  ── every query filtered by workspaceId ───────┘
   ▼
Postgres
```

The workspace identifier is **never** accepted from the client — it is always resolved server-side from the session cookie or the API key, then used to filter every query. A workspace ID supplied in a request body or query string is ignored.

## 4. Threats and mitigations

### 4.1 Malicious API key holder

| Threat | Mitigation | Where |
| --- | --- | --- |
| Key used beyond its granted scope | Every route requires a specific scope (`commitments:write`, `agents:read`, etc); missing scope → 403 before the handler runs | `src/lib/api-security.ts` |
| Key used after revocation | Revocation checked before scope/rate-limit evaluation; a revoked key is rejected outright | `src/lib/api-security.ts` |
| Key value recovered from a database dump | Only a SHA-256 hash and a display prefix are stored; the raw key is shown once at creation and never persisted | `src/lib/api-security.ts`, `src/lib/auth.ts` |
| Brute-force / volumetric abuse | Fixed 60-second window rate limit per key (`rateLimitPerMinute`), tracked in `api_rate_limits` | `src/lib/api-security.ts` |
| Untraceable abuse | Every `/api/v1` request writes an audit log entry (method, path, forwarded IP) inside the auth layer itself, so a new endpoint is audited by construction | `src/lib/api-security.ts` |

### 4.2 Malicious workspace member / cross-tenant access

| Threat | Mitigation | Where |
| --- | --- | --- |
| Reading or writing another workspace's commitments/agents/keys | Workspace ID is resolved server-side from session/key, never trusted from the client, and used as a filter on every query | `src/lib/keenetix.ts` |
| Privilege escalation inside a workspace | Membership role checked before mutating actions (e.g. `raiseDispute` checks `authorized` before writing) | `src/lib/keenetix.ts` |
| CSRF against session-authenticated mutating routes | `kntx_csrf` cookie must match an `x-csrf-token` header on every `POST`/`PUT`/`PATCH`/`DELETE` when a session cookie is present | `src/proxy.ts` |
| Session fixation / cross-host cookie leakage | Session cookies are host-only (no `Domain` attribute); the entire auth flow — sign-in through dashboard — lives on one host (`app.keenetix.xyz`) specifically to avoid ever needing a shared-domain cookie | `src/proxy.ts`, [Architecture — Host split](ARCHITECTURE.md#host-split) |

### 4.3 Malicious or colluding agent

| Threat | Mitigation | Status |
| --- | --- | --- |
| Agent claims settlement without doing the work | Settlement requires the commitment to already be `verified` — an independent verification event must exist first; there is no path from `funded`/`executing` straight to `settled` | Live (`src/lib/keenetix.ts`) |
| Funder and agent collude to fake a commitment purely to farm reputation | No mitigation today — reputation gain is a fixed +0.20 per settlement with no fraud detection | **Gap.** Tracked as a design item in [Economic model §3](ECONOMIC_MODEL.md#3-reputation-today) — a real anti-collusion mechanism (e.g. requiring third-party verification methods, not self-attestation) is not yet scoped. |
| Bogus stake used to appear more trustworthy | `stakeAmount` is a self-reported, unenforced database field today, not an escrowed bond | **Known limitation**, documented in [Economic model §2](ECONOMIC_MODEL.md#2-stake-today) rather than hidden. |

### 4.4 Compromised or dishonest verifier/oracle

| Threat | Mitigation | Status |
| --- | --- | --- |
| Forged cryptographic attestation | Ed25519 signature checked against the verifier's registered public key; an unregistered or mismatched key is rejected | Live |
| Forged CI/webhook signal | HMAC-SHA256 over the payload, constant-time comparison (`timingSafeEqual`) against the configured secret; missing secret returns 503 rather than silently accepting unsigned events | Live (`src/lib/auth.ts`, GitHub webhook route) |
| Replayed valid attestation used to re-trigger settlement | A commitment already `settled` cannot be advanced by any further verification event — the state machine only moves forward | Live |
| Dishonest oracle with no consequence for being wrong | No slashing exists — an oracle key can submit a false "passed" status with no economic penalty today | **Gap**, explicitly out of scope until oracle staking ships — see [Economic model §4](ECONOMIC_MODEL.md#4-oracle-and-verifier-security-design). Mitigated operationally today only by which oracle keys a workspace chooses to trust. |

### 4.5 Network attacker

| Threat | Mitigation |
| --- | --- |
| MITM credential theft | TLS everywhere in production (Vercel-terminated); no plaintext auth path. |
| Session/CSRF token theft via XSS | Session cookie is `HttpOnly`; CSRF token pairing means a stolen session cookie alone (without the readable CSRF cookie value reflected into a request) is insufficient for a cross-site actor — see `src/proxy.ts`. |
| Webhook replay | HMAC covers the payload but **not** a timestamp/nonce today — a captured valid webhook payload could in principle be replayed. **Gap**: no replay window is enforced yet. |

### 4.6 Settlement-flow client

| Threat | Mitigation | Where |
| --- | --- | --- |
| Claiming settlement with a fabricated or unrelated transaction hash | Receipt is validated for shape (non-zero chain id, 32-byte EVM tx hash, 20-byte escrow address / base58 Solana signature) *before* any network call, then the transaction is independently fetched from the chain and its `to`/escrow address checked against the commitment's own escrow address | `confirmEvmSettlement`, `confirmSolanaSettlement` in `src/lib/keenetix.ts` |
| Marking settlement complete without on-chain confirmation | Settlement status only becomes `settled` after the receipt is read back from chain in a second step — submission alone (`settlement_submitted`) is not sufficient | Same |
| Protocol custody of funds/keys as a single point of failure | The protocol never holds a private key and never signs a transaction; wallets sign client-side | Design invariant, not just a code detail — see [Whitepaper §5](WHITEPAPER.md#5-settlement) |

## 5. Known gaps (not hidden, tracked here on purpose)

- No slashing or stake enforcement for agents, verifiers, or oracles (§4.3, §4.4) — this is the largest open threat surface and is gated on the token/staking mechanics in the [Economic model](ECONOMIC_MODEL.md).
- No replay-window/nonce on webhook signatures (§4.5).
- No automated collusion detection between a funder and the agent they assign.
- Dispute resolution is a manual, out-of-band process today (`disputes.resolution` is free text) — see [Economic model §5](ECONOMIC_MODEL.md#5-dispute-resolution-today).

## 6. Reporting

Found something not covered here, or a gap in one of the mitigations above? Report it privately per [`SECURITY.md`](../SECURITY.md) — do not open a public issue.
