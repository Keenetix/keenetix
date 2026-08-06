# Keenetix Whitepaper v1

**Economic infrastructure for autonomous intelligence.**

This document is the single entry point for understanding what Keenetix is, why the commitment primitive exists, and how the pieces fit together. It links out to the [Economic model](ECONOMIC_MODEL.md), [Threat model](THREAT_MODEL.md), and [Architecture](ARCHITECTURE.md) documents rather than repeating them — read this first, then go deep on the piece you need.

## TL;DR

AI agents can reason and act, but they cannot yet be trusted with capital by a counterparty who has never met them. Keenetix is a protocol-native object — the **commitment** — that encodes an objective, a budget, a deadline, and machine-checkable verification rules. Capital is escrowed when the commitment is funded and released only when independent proof arrives. Every settled outcome writes into a portable reputation record for the agent that did the work.

```
Intent → Commitment → Execution → Verification → Settlement → Reputation
```

If you understand that one line and the schema in [§3](#3-the-commitment-object), you understand the protocol.

## 1. The problem

Two failure modes block autonomous agents from transacting today:

- **Blind delegation** — a human pre-authorizes a budget and hopes the agent spends it well, with no way to tie the release of funds to proof of outcome.
- **Blind trust in counterparties** — there is no portable signal that an agent (or a human hiring one) has a track record worth relying on, so every relationship starts from zero.

Keenetix removes the "hope" step. Funds move only when a verification condition defined in advance is satisfied by evidence checked after the fact.

## 2. Design principles

1. **Proof gates payment, not identity.** Keenetix does not vouch for who an agent is — it vouches for whether a specific, pre-declared condition was met.
2. **Verification is pluggable, not opinionated.** A commitment can be settled by CI output, a cryptographic attestation, an oracle, or a scoped human reviewer — see [§4](#4-verification).
3. **The protocol never holds keys.** Wallets sign client-side; the server only reads receipts back from chain. See the [Threat model](THREAT_MODEL.md#settlement) for why this boundary matters.
4. **Reputation is earned, not declared.** An agent's track record is a function of settled commitments, not a self-reported score.
5. **Honesty about maturity.** Every claim in this document is labeled **live** (shipped, in the running codebase) or **design** (the target this system is built toward, not yet implemented). Do not read a "design" label as a claim about the present.

## 3. The commitment object

A commitment is the core economic object — created before execution, immutable in its terms, and the canonical record of what was promised and what happened.

```json
{
  "objective": "Resolve authentication CI failure",
  "budget": { "amount": 1250, "asset": "USDC" },
  "deadline": "2026-12-14T17:00:00Z",
  "verificationRules": [
    "ci.checks.passing",
    "security.scan.clear",
    "review.attestation"
  ],
  "settlement": { "releaseOn": "verified" }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `objective` | string | The precise desired outcome. Free text; not machine-evaluated. |
| `budget` | `{ amount, asset }` | Maximum capital authorized for execution. Held in escrow once funded. |
| `deadline` | ISO 8601 timestamp | The point after which an unfulfilled commitment can expire. |
| `verificationRules` | string[] | Proof conditions that must all pass before settlement is eligible. |
| `settlement.releaseOn` | `"verified"` | **Live.** Currently the only supported trigger — release happens once every verification rule has a passing event. Partial/conditional release schedules are **design**, not implemented. |

**Lifecycle (live):** `draft → funded → executing → verified → settled`, with `disputed` reachable from any non-terminal state via a manual dispute (`raiseDispute` in `src/lib/keenetix.ts`). There is no automatic state regression — a settled commitment cannot be reopened by a late or duplicate proof.

## 4. Verification

Four verification methods are supported, each with an independent trust mechanism (implementation: `src/lib/keenetix.ts`, routes under `/api/v1/verifications/*`):

| Method | Trust mechanism | Status |
| --- | --- | --- |
| Deterministic (CI/CD, webhooks) | HMAC-SHA256, constant-time comparison against a per-integration secret | **Live** — GitHub webhook integration ships today. |
| Cryptographic (signatures, attestations) | Ed25519 signature checked against a registered verifier public key | **Live.** |
| Oracle-backed | Scoped API key plus recorded evidence payload | **Live** as a data path; economic slashing of dishonest oracles is **design** (see [Economic model §4](ECONOMIC_MODEL.md#4-oracle-and-verifier-security-design)). |
| Trusted verification (human reviewer) | Scoped reviewer attestation, same Ed25519 path as cryptographic verification | **Live.** |

A verification event can only advance a commitment that is `funded` or `executing`. This ordering constraint is enforced in `advanceDemo`/settlement code, not just in UI copy.

## 5. Settlement

Settlement is a two-step handshake, not a single write: a receipt is submitted (`POST /api/v1/settlements`), then independently read back from the chain (EVM `eth_getTransactionReceipt` or Solana `getParsedTransaction`) before the commitment is marked `settled`. See `confirmEvmSettlement` / `confirmSolanaSettlement` in `src/lib/keenetix.ts`. The protocol never custodies a private key — this is a hard boundary, not a configuration choice. Full detail: [Threat model §5](THREAT_MODEL.md#5-settlement).

## 6. Reputation

On confirmed settlement, the assigned agent's reputation score increases by a fixed **+0.20**, capped at 99.99, and a `reputation_records` row is written with reliability/quality/efficiency components. **This is live but simple** — a single fixed delta per settlement, not yet a function of commitment size, deadline adherence, or dispute history. A richer reputation function is **design**, tracked in [Economic model §3](ECONOMIC_MODEL.md#3-reputation-weighting-design).

## 7. Economic model (summary)

$KNTX is the network's proposed alignment token. **No token contract is deployed today** — settlement runs on USDC over EVM or Solana rails, and agent `stakeAmount` is a database field used to filter the marketplace, not a slashable on-chain position. The full breakdown of what's live vs. designed is in [Economic model](ECONOMIC_MODEL.md).

## 8. Threat model (summary)

Six actor classes are considered: a malicious API key holder, a malicious workspace member, a malicious or colluding agent, a malicious or compromised verifier/oracle, a network-level attacker (MITM/replay), and a malicious client of the settlement flow. Each is mapped to the control that currently mitigates it — see [Threat model](THREAT_MODEL.md).

## 9. SDK

A TypeScript client (`@keenetix/sdk`, [`packages/keenetix-sdk`](../packages/keenetix-sdk)) wraps every `/api/v1/*` route: `commitments.list/create`, `agents.list/register`, `verifications.attest/oracle`, `settlements.submit`. It is a thin fetch wrapper with typed inputs and bearer-key auth — no retry/backoff, pagination, or streaming yet. Those are **design**, not scoped for v1.

## 10. What "understood in under 5 minutes" means

A developer who reads §0 (TL;DR) and §3 (commitment object) has the whole mental model: an escrowed promise that only pays out against proof. Everything else in this whitepaper — verification plumbing, settlement's two-step handshake, reputation math — is depth for someone about to integrate, not a prerequisite for understanding the idea.

## 11. Status and roadmap

| Area | Status |
| --- | --- |
| Commitment lifecycle, escrow bookkeeping, settlement confirmation | Live |
| CI/webhook, cryptographic, and human-attestation verification | Live |
| Oracle verification data path | Live |
| Marketplace, bidding, disputes (manual) | Live |
| $KNTX token, on-chain staking, slashing, fee capture | Design |
| Automated dispute resolution | Design |
| Reputation as a function of commitment risk/size | Design |

See [Architecture](ARCHITECTURE.md) for the request-level implementation detail behind every "Live" row above.
