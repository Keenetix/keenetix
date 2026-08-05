# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security report.**

Use GitHub's private reporting — [Report a vulnerability](https://github.com/Keenetix/keenetix/security/advisories/new) — or email **hello@keenetix.xyz**.

Please include:

- What the issue is and where (route, file, or endpoint)
- Reproduction steps or a proof of concept
- What an attacker gains — data exposure, value released without proof, cross-tenant access, and so on

We aim to acknowledge within 3 business days and to give a remediation timeline within 10. We'll credit you in the advisory unless you'd rather stay anonymous.

## Scope

This project handles capital release against cryptographic proof. Reports touching these areas get priority:

| Area | Why it matters |
| --- | --- |
| API key auth and scope enforcement (`src/lib/api-security.ts`) | A scope bypass lets a key act beyond its grant. |
| Workspace isolation | Any query reaching rows outside the identity's `workspaceId` is a tenancy break. |
| Commitment state transitions (`src/lib/keenetix.ts`) | A path that reaches `settled` without verification releases value without proof. |
| Settlement receipt validation | Accepting a forged, replayed, or unrelated transaction hash as confirmation. |
| Signature verification | Ed25519 attestation checks and the GitHub webhook HMAC comparison. |
| Session handling (`src/lib/auth.ts`) | Session fixation, cookie scope, or hash bypass. |

Out of scope: findings against the marketing pages with no data impact, missing hardening headers with no demonstrated exploit, rate-limit tuning opinions, automated scanner output without a working proof of concept, and social engineering.

## Handling secrets

If you find a credential in this repository or in a deployment, report it privately and do not use it. No `.env*` file is tracked by git, and `.gitignore` excludes `.env*` and `.vercel`. Raw API keys and session tokens are never stored — only SHA-256 hashes are persisted — so a database dump alone should not yield a usable credential. A report showing otherwise is a valid finding.

## Supported versions

`main` is the only supported branch. Fixes ship forward; there are no backports.
