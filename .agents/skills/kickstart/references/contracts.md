# Contract Reference

## Network

| Item | Value |
|------|-------|
| Chain | Base (chain ID 8453) |
| RPC | `https://mainnet.base.org` |
| Block Explorer | `https://basescan.org` |

## Factory Contract

**Address:** `0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb`

### Functions

#### createToken (write, payable)

Create a new token with a bonding curve. Send ETH with the call to make an initial purchase.

```
createToken(string name, string symbol, string uri, uint256 deadline)
  returns (address curveAddress, address tokenAddress, uint256 tokensReceived)
```

**cast example:**

```bash
cast send 0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb \
  "createToken(string,string,string,uint256)(address,address,uint256)" \
  "MyToken" "MTK" "ipfs://bafkrei..." $(cast to-uint256 $(( $(date +%s) + 600 ))) \
  --value 0.01ether \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

#### totalCurves (view)

Returns the total number of bonding curves created.

```
totalCurves() returns (uint256)
```

```bash
cast call 0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb \
  "totalCurves()(uint256)" \
  --rpc-url https://mainnet.base.org
```

#### getCurves (view)

Returns a paginated list of curve addresses.

```
getCurves(uint256 start, uint256 count) returns (address[])
```

```bash
cast call 0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb \
  "getCurves(uint256,uint256)(address[])" 0 10 \
  --rpc-url https://mainnet.base.org
```

#### allCurves (view)

Returns the curve address at a specific index.

```
allCurves(uint256 index) returns (address)
```

#### getCreatorCurves (view)

Returns all curve addresses created by a specific address.

```
getCreatorCurves(address creator) returns (address[])
```

```bash
cast call 0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb \
  "getCreatorCurves(address)(address[])" 0xYOUR_ADDRESS \
  --rpc-url https://mainnet.base.org
```

#### getCreatorCurveCount (view)

Returns the number of curves created by a specific address.

```
getCreatorCurveCount(address creator) returns (uint256)
```

#### curveCreator (view)

Returns the creator address for a given curve.

```
curveCreator(address curve) returns (address)
```

#### tokenToCurve (view)

Resolves a token address to its bonding curve address. Returns the zero address if the token is not a Kickstart token.

```
tokenToCurve(address token) returns (address)
```

#### isCurve (view)

Check whether an address is a valid Kickstart bonding curve.

```
isCurve(address curve) returns (bool)
```

#### getBondingCurveConfig (view)

Returns the global bonding curve configuration.

```
getBondingCurveConfig() returns (
  uint256 initialVirtualEth,
  uint256 bondingCurveSupply,
  uint256 currentGraduationThreshold,
  uint256 feePercent,
  uint256 feeDenominator,
  uint256 totalSupply,
  uint256 lpSupply
)
```

#### estimateTokensForEth (view)

Estimate how many tokens a given ETH amount would buy on a fresh curve (pre-creation).

```
estimateTokensForEth(uint256 ethAmount) returns (uint256 tokensOut)
```

#### estimateEthForTokens (view)

Estimate how much ETH is required to purchase a given token amount on a fresh curve (pre-creation).

```
estimateEthForTokens(uint256 tokenAmount) returns (uint256 ethRequired)
```

#### getMaxPurchaseEth (view)

Returns the maximum ETH that can be spent in a single purchase.

```
getMaxPurchaseEth() returns (uint256 maxEth)
```

#### getMaxPurchasableTokens (view)

Returns the maximum tokens that can be purchased in a single transaction.

```
getMaxPurchasableTokens() returns (uint256 maxTokens)
```

### Events

#### CurveCreated

Emitted when a new token and bonding curve are created.

```
event CurveCreated(
  address indexed curve,
  address indexed token,
  string name,
  string symbol,
  address indexed creator
)
```

Topic 0 (event signature): `0x` + keccak256 of the event signature.

To parse from a transaction receipt:
- Find the log emitted by the factory address (`0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb`)
- `topics[1]` = curve address (right-padded to 32 bytes, take last 20 bytes)
- `topics[2]` = token address
- `topics[3]` = creator address
- `data` = ABI-encoded name and symbol strings

#### InitialPurchase

Emitted when the creator makes an initial purchase during token creation (when ETH is sent with `createToken`).

```
event InitialPurchase(
  address indexed curve,
  address indexed creator,
  uint256 ethAmount,
  uint256 tokensReceived
)
```
