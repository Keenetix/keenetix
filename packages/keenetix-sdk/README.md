# Keenetix SDK
A lightweight TypeScript client for the Keenetix economic execution API.
```ts
import { Keenetix } from "@keenetix/sdk";
const keenetix = new Keenetix({ apiKey: process.env.KEENETIX_API_KEY! });
await keenetix.commitments.create({
  objective: "Ship the auth refactor",
  budget: 4800,
  deadline: "2026-12-14T17:00:00Z",
  verificationRules: ["ci.checks.passing", "security.scan.clear"],
});
```
The API contract is published at `/openapi.yaml` and uses scoped `kntx_live_` Bearer keys.