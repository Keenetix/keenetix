---
name: kickstart
description: >
  Create tokens on EasyA Kickstart, a fair launch launchpad on Base.
  Upload metadata and deploy tokens with bonding curves using just curl
  and cast (Foundry). No SDK, no API keys, no npm required.
metadata:
  author: easya-tech
  version: "1.0"
---

# Kickstart

Kickstart is a fair launch launchpad. Anyone can launch their ideas and gain instant market validation. Each token starts with a bonding curve -- as people buy, the price rises automatically. When approximately 4.5 ETH is collected, the token graduates to Aerodrome DEX with real liquidity on Base.

Website: https://kickstart.easya.io

## Prerequisites

- A wallet private key with ETH on Base (for gas + optional initial buy)
- Foundry installed (`cast` CLI) -- install via `curl -L https://foundry.paradigm.xyz | bash && foundryup`

No npm, no Node.js, no API keys, no SDK required.

## Quick Start

Creating a token is two commands: upload metadata, then create the token on-chain.

### Step 1: Upload metadata

Upload your token's image and metadata to IPFS via the hosted Kickstart API. This returns an `ipfs://` URI to use on-chain.

```bash
curl -X POST https://kickstart.easya.io/api/upload/metadata \
  -F "name=MyToken" \
  -F "symbol=MTK" \
  -F "description=A token for my project" \
  -F "image=@logo.png"
```

The response includes a `uri` field:

```json
{
  "uri": "ipfs://bafkrei...",
  "metadataCid": "bafkrei...",
  "imageCid": "bafkrei..."
}
```

Save the `uri` value for step 2.

Optional metadata fields: `websiteUrl`, `twitterUrl`, `telegramUrl`, `videoUrl`. See [metadata API reference](references/metadata-api.md) for full details.

### Step 2: Create the token on-chain

Call `createToken` on the factory contract. The `--value` flag sets the initial buy amount (can be `0` for no initial purchase).

```bash
cast send 0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb \
  "createToken(string,string,string,uint256)" \
  "MyToken" "MTK" "ipfs://bafkrei..." $(cast to-uint256 $(( $(date +%s) + 600 ))) \
  --value 0.01ether \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

Parameters:
- Arg 1: Token name
- Arg 2: Token symbol
- Arg 3: Metadata URI (from step 1)
- Arg 4: Deadline (Unix timestamp -- the example sets 10 minutes from now)
- `--value`: ETH for the initial buy (optional, `0` to skip)

The transaction emits a `CurveCreated` event with the new curve and token addresses. Parse the logs to retrieve them:

```bash
cast receipt <TX_HASH> --rpc-url https://mainnet.base.org
```

Look for the log from `0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb` -- `topics[1]` is the curve address, `topics[2]` is the token address.

## Contract Cheat Sheet

| Item | Value |
|------|-------|
| Factory | `0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb` |
| Chain | Base (chain ID 8453) |
| RPC | `https://mainnet.base.org` |
| Explorer | `https://basescan.org` |
| createToken | `createToken(string name, string symbol, string uri, uint256 deadline) payable returns (address curve)` |
| CurveCreated event | `CurveCreated(address indexed curve, address indexed token, string name, string symbol)` |
| Graduation | ~4.5 ETH collected triggers automatic graduation to Aerodrome DEX |

## How It Works

1. **Token creation** -- A new ERC-20 token is deployed with a bonding curve contract. The curve controls the token's supply and price.
2. **Bonding curve** -- Price increases as more ETH is deposited. Early buyers get more tokens per ETH. The curve ensures fair, transparent pricing with no presale or insider allocation.
3. **Graduation** -- When approximately 4.5 ETH is collected in the curve, the token automatically graduates to Aerodrome DEX. Liquidity is deployed on-chain, and the token becomes freely tradeable on the open market.

## References

| File | Description |
|------|-------------|
| [references/contracts.md](references/contracts.md) | Factory ABI, view functions for querying existing tokens |
| [references/metadata-api.md](references/metadata-api.md) | Full metadata upload API reference with all fields and constraints |
