# Metadata Upload API

The Kickstart platform hosts a public API for uploading token metadata to IPFS. No API key or account required.

## Endpoint

```
POST https://kickstart.easya.io/api/upload/metadata
Content-Type: multipart/form-data
```

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Token name |
| `symbol` | string | Yes | Token symbol (ticker) |
| `image` | file | Yes | Token logo image |
| `description` | string | No | Token description |
| `websiteUrl` | string | No | Project website URL |
| `twitterUrl` | string | No | Twitter/X profile URL |
| `telegramUrl` | string | No | Telegram group URL |
| `videoUrl` | string | No | Video URL (e.g. YouTube) |

## Image Constraints

- **Formats:** JPEG, PNG, GIF, WebP
- **Max size:** 5 MB
- **Auto-optimization:** Images are resized to max 800px and converted to WebP before pinning to IPFS

## Response

```json
{
  "uri": "ipfs://bafkrei...",
  "gatewayUrl": "https://...",
  "metadataCid": "bafkrei...",
  "imageCid": "bafkrei...",
  "metadata": {
    "name": "MyToken",
    "symbol": "MTK",
    "description": "A token for my project",
    "image": "ipfs://bafkrei...",
    "showName": true,
    "createdOn": "easya-kickstart"
  }
}
```

| Field | Description |
|-------|-------------|
| `uri` | The IPFS URI to pass as the `uri` argument to `createToken` |
| `gatewayUrl` | HTTPS gateway URL for previewing the metadata |
| `metadataCid` | Raw IPFS CID of the metadata JSON |
| `imageCid` | Raw IPFS CID of the uploaded image |
| `metadata` | The metadata JSON object stored on IPFS |

## Example

### Minimal (required fields only)

```bash
curl -X POST https://kickstart.easya.io/api/upload/metadata \
  -F "name=MyToken" \
  -F "symbol=MTK" \
  -F "image=@logo.png"
```

### Full (all fields)

```bash
curl -X POST https://kickstart.easya.io/api/upload/metadata \
  -F "name=MyToken" \
  -F "symbol=MTK" \
  -F "description=A fair launch token for my project" \
  -F "image=@logo.png" \
  -F "websiteUrl=https://myproject.com" \
  -F "twitterUrl=https://x.com/myproject" \
  -F "telegramUrl=https://t.me/myproject" \
  -F "videoUrl=https://youtube.com/watch?v=..."
```

### Extracting the URI

Use `jq` to extract the `uri` field from the response:

```bash
URI=$(curl -s -X POST https://kickstart.easya.io/api/upload/metadata \
  -F "name=MyToken" \
  -F "symbol=MTK" \
  -F "image=@logo.png" | jq -r '.uri')

echo $URI
# ipfs://bafkrei...
```

## Metadata JSON Format

The metadata stored on IPFS follows this structure:

```json
{
  "name": "MyToken",
  "symbol": "MTK",
  "description": "A fair launch token for my project",
  "image": "ipfs://bafkrei...",
  "showName": true,
  "createdOn": "easya-kickstart",
  "twitter": "https://x.com/myproject",
  "telegram": "https://t.me/myproject",
  "website": "https://myproject.com",
  "video": "https://youtube.com/watch?v=..."
}
```

The `image` field contains an `ipfs://` URI pointing to the optimized image. The Kickstart frontend resolves this via an IPFS gateway for display.

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `name` or `symbol` |
| 400 | Missing `image` or empty file |
| 400 | Invalid image type (not JPEG/PNG/GIF/WebP) |
| 400 | Image exceeds 5 MB |
| 500 | IPFS upload failure |
