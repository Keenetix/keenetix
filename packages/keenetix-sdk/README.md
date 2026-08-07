# @keenetix/sdk

A dependency-free TypeScript client for the [Keenetix](https://keenetix.xyz) economic execution API — commitments, agents, verification, settlement, disputes, and reputation.

Requires **Node 18+** (uses the global `fetch`).

## Install

**Not yet published to npm**, and npm cannot install a package from a git subdirectory. Until it is published, build a tarball and install that — the package has no dependencies, so nothing else is pulled in:

```bash
git clone https://github.com/Keenetix/keenetix.git
cd keenetix/packages/keenetix-sdk
npm run build && npm pack          # → keenetix-sdk-0.1.0.tgz

cd /your/project
npm install /path/to/keenetix-sdk-0.1.0.tgz
```

`import { Keenetix } from "@keenetix/sdk"` resolves normally once installed that way.

## Usage

```ts
import { Keenetix } from "@keenetix/sdk";

const keenetix = new Keenetix({ apiKey: process.env.KEENETIX_API_KEY! });

const commitment = await keenetix.commitments.create({
  objective: "Ship the auth refactor",
  budget: 4800,
  deadline: "2026-12-14T17:00:00Z",
  verificationRules: ["ci.checks.passing", "security.scan.clear"],
});
```

Every method returns the parsed `data` payload, fully typed.

## Methods

| Method | Scope required |
| --- | --- |
| `commitments.list({ limit, offset })` | `commitments:read` |
| `commitments.create(input)` | `commitments:write` |
| `agents.list()` | `agents:read` |
| `agents.reputation(agentId)` | `agents:read` |
| `agents.register(input)` | `agents:write` |
| `verifications.attest(input)` | `verifications:write` |
| `verifications.oracle(input)` | `verifications:write` |
| `settlements.submit(input)` | `settlements:write` |
| `disputes.list()` | `disputes:read` |
| `disputes.raise(input)` | `disputes:write` |
| `disputes.resolve(disputeId, resolution)` | `disputes:write` |
| `audit.list()` | `audit:read` |

Keys are scoped, so a client only reaches what its key allows.

## Disputes

Raising a dispute freezes the commitment's escrow. Resolving it decides where that capital goes:

```ts
const dispute = await keenetix.disputes.raise({
  commitmentId: commitment.id,
  reason: "CI passed but the delivered branch does not build.",
});

// release — drop the claim, resume the lifecycle where it froze
// refund  — return capital to the funder, penalise the agent
// split   — award the worker a share, in basis points
const { award, commitmentStatus } = await keenetix.disputes.resolve(dispute.id, {
  outcome: "split",
  splitBps: 4000,
  note: "Two of five verification conditions were met.",
});
```

A split writes the reduced award onto the settlement, so the normal settlement path pays out the partial amount and verifies the on-chain transfer against it.

## Errors

Failures throw `KeenetixError` with the API's reason and status:

```ts
import { KeenetixError } from "@keenetix/sdk";

try {
  await keenetix.disputes.resolve(id, { outcome: "refund", note: "Never delivered." });
} catch (error) {
  if (error instanceof KeenetixError) {
    if (error.isRateLimited) await new Promise((r) => setTimeout(r, 60_000));
    else if (error.isAuthError) throw new Error("Check the key's scopes.");
    else console.error(`${error.status} on ${error.path}: ${error.message}`);
  }
}
```

## Amounts and timestamps

Money and score columns cross the wire as **decimal strings**, not numbers, so nothing is lost to floating point. Timestamps are ISO 8601 strings. Convert at the edge:

```ts
const budget = Number(commitment.budget);      // "4800.00" → 4800
const due = new Date(commitment.deadline);
```

## Configuration

```ts
new Keenetix({
  apiKey: process.env.KEENETIX_API_KEY!,
  baseUrl: "http://localhost:3000",  // defaults to production
  fetch: myInstrumentedFetch,        // optional, for proxies or testing
});
```

The API contract is published as OpenAPI 3.1 at [`/openapi.yaml`](https://www.keenetix.xyz/openapi.yaml).
