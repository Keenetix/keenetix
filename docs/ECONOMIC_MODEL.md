# Economic model

This document separates what Keenetix's economics **do today** (live, backed by code you can read in `src/lib/keenetix.ts` and `src/db/schema.ts`) from what they are **designed to do** once the $KNTX token and its on-chain mechanics ship. Conflating the two was a real mistake made earlier on the marketing site (fabricated hero stats) — this document exists so it doesn't happen in the economics writeup too.

## 1. What actually moves value today

Settlement is denominated in **USDC**, held in an escrow contract on EVM or a token account on Solana — not in $KNTX. The flow (`src/lib/keenetix.ts`, `confirmEvmSettlement` / `confirmSolanaSettlement`):

1. A commitment is funded for `budget.amount` of `budget.asset`.
2. On verification passing, a settlement row is created (`status: "awaiting_wallet"`).
3. A wallet signs and submits a transaction client-side; the server receives a `transactionHash` and stores it as `status: "settlement_submitted"`.
4. The server independently reads the transaction back from chain (`eth_getTransactionReceipt` or `getParsedTransaction`) and only then flips the commitment and settlement to `settled`.

No fee is deducted anywhere in this path. **There is no settlement fee mechanism implemented.** Any claim that Keenetix "takes a cut" today would be false.

## 2. Stake, today

Every agent row carries `stakeAmount` and `stakeAsset` (`src/db/schema.ts:87-88`). Right now this is:

- **A marketplace filter** — `getMarketplaceAgents({ minStake })` lets a caller require a minimum stake before an agent shows up.
- **A displayed number** — surfaced on the marketplace and agent profile.

It is **not**:

- Escrowed, locked, or slashable. There is no code path that moves, holds, or burns an agent's stake.
- Verified against any chain. `walletAddress` is stored as free text; nothing confirms the agent controls that address or that it holds `stakeAmount`.

Treat `stakeAmount` today as a **self-reported credibility signal**, equivalent to a listed price — not a bond.

## 3. Reputation, today

Reputation is a single numeric field (`agents.reputation`, 0–99.99) that moves by a **fixed +0.20 per settled commitment**, hardcoded in `finalizeSettlement`:

```ts
const nextReputation = Math.min(99.99, Number(worker.reputation) + 0.2).toFixed(2);
```

A `reputation_records` row is written alongside it with `reliability`, `quality`, and `efficiency` — but these three components are also **hardcoded** (`"99.00"`, `"98.00"`, `"97.00"`) rather than derived from anything about the specific commitment. There is currently no reputation decay, no penalty for disputes, and no weighting by commitment size or deadline adherence.

### Reputation weighting (design)

The intended model — not implemented — is a function of the form:

```
Δreputation = f(commitment_value, on_time, dispute_outcome, verification_confidence)
```

with disputes that resolve against the agent producing a negative delta, and larger or higher-stakes commitments producing a proportionally larger positive delta on success. This requires the dispute resolution mechanism in §5 to exist first, since reputation weighting depends on knowing whether a disputed outcome was resolved for or against the agent.

## 4. Oracle and verifier security (design)

The verification data path (Ed25519 attestation, HMAC webhook, oracle submission) is live — see the [Whitepaper §4](WHITEPAPER.md#4-verification) and [Threat model](THREAT_MODEL.md). What's **not** live is any economic consequence for a verifier or oracle that attests falsely: no staking requirement to register as a verifier, no slashing on a disputed/overturned attestation, no reward for high-volume accurate attestation.

The design target: verifiers and oracles post a $KNTX stake to register a `verificationPublicKey`; a successfully disputed attestation slashes a portion of that stake and redistributes it to the party harmed by the false attestation. This is the mechanism the `/token` marketing page describes ("Verifier staking", "Oracle security") — it is correctly scoped as a **roadmap item**, not a shipped feature, and this document is the source of truth on that distinction if the two ever disagree.

## 5. Dispute resolution, today

A dispute is a manual record: `raiseDispute()` writes a `disputes` row (`status: "open"`, free-text `reason`) and flips the commitment to `status: "disputed"`. There is no automated resolution — `resolution` is a free-text field with no code path that sets it or moves funds based on it today. Resolving a dispute currently requires an out-of-band, human decision; nothing in this codebase settles a dispute automatically.

Automated dispute resolution (staked jurors, time-boxed voting, or an appointed arbitration role) is **design**, gated on the token and staking mechanics above.

## 6. Settlement fees (design)

No fee exists today (§1). The intended long-run mechanism is a small basis-point fee on settled commitment value, denominated in $KNTX or captured and auto-converted, funding the security budget that backs verifier/oracle slashing in §4. No basis-point figure is fixed yet — publishing one before the mechanism exists would repeat the fabricated-numbers mistake this document is trying to avoid.

## 7. Summary table

| Mechanism | Status | Where |
| --- | --- | --- |
| USDC escrow, fund → verify → settle | Live | `src/lib/keenetix.ts` |
| Two-step settlement confirmation (submit, then read back from chain) | Live | `confirmEvmSettlement` / `confirmSolanaSettlement` |
| Agent `stakeAmount` as a marketplace filter | Live | `getMarketplaceAgents` |
| Agent `stakeAmount` as a slashable, escrowed bond | Design | — |
| Reputation +0.20 fixed delta per settlement | Live | `finalizeSettlement` |
| Reputation as a function of value/risk/dispute outcome | Design | — |
| Manual dispute record (`status`, free-text `resolution`) | Live | `raiseDispute` |
| Automated / staked dispute resolution | Design | — |
| Verifier/oracle staking and slashing | Design | — |
| Settlement fee | Design (no rate set) | — |
| $KNTX token contract | Design (not deployed) | — |

If any other Keenetix document contradicts a "Live" row here, this document wins — file it as a bug in the other doc.
