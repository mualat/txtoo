# TXToo Worker API

**Cloudflare Workers backend for TXToo - Zero-knowledge encrypted text storage**

This is the serverless backend API for TXToo, built on Cloudflare Workers with D1 database. It provides secure, ephemeral storage for client-side encrypted data with automatic expiration.

## 🏗️ Architecture

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Language**: TypeScript
- **API Style**: RESTful JSON API
- **Security**: Zero-knowledge architecture - server never sees plaintext

## 🔐 Security Model

The worker implements a **zero-knowledge architecture**:
- Only stores encrypted ciphertext, never plaintext
- No access to encryption keys (keys are in URL fragments, never sent to server)
- Automatic expiration and deletion of expired data
- CORS-enabled for client-side access
- No user tracking or analytics

## 📡 API Endpoints

### `POST /api/submit`
Store encrypted text with automatic expiration.

**Request:**
```json
{
  "ttl": 86400,
  "cipherText": "base64url-encoded-encrypted-data",
  "iv": "base64url-encoded-initialization-vector"
}
```

**Response (200 OK):**
```json
{
  "type": "success",
  "status": 200,
  "data": {
    "id": "abc123xyz789",
    "url": "https://your-domain.com/abc123xyz789",
    "expiresAt": 1706745600
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "type": "error",
  "status": 400,
  "message": "Missing required parameters: ttl, cipherText, iv"
}
```

---

### `GET /api/fetch/{id}`
Retrieve encrypted text by ID.

**Response (200 OK):**
```json
{
  "type": "success",
  "status": 200,
  "data": {
    "id": "abc123xyz789",
    "cipher_text": "base64url-encoded-encrypted-data",
    "iv": "base64url-encoded-initialization-vector",
    "expiresAt": 1706745600
  }
}
```

**Error Responses:**

*404 Not Found:*
```json
{
  "type": "error",
  "status": 404,
  "message": "Text not found"
}
```

*410 Gone (Expired):*
```json
{
  "type": "error",
  "status": 410,
  "message": "Text has expired"
}
```

---

### `OPTIONS *`
CORS preflight handler for all routes.

**Response:** Returns appropriate CORS headers based on configuration.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Install dependencies
pnpm install

# Login to Cloudflare
npx wrangler login
```

### Database Setup

1. **Create D1 database:**
   ```bash
   npx wrangler d1 create TXToo-db
   ```

2. **Copy the database ID** from the output and update `wrangler.jsonc`:
   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "TXToo-db",
       "database_id": "your-database-id-here"
     }
   ]
   ```

3. **Initialize the schema:**
   ```bash
   npx wrangler d1 execute TXToo-db --file=schema.sql
   ```

### Development

```bash
# Start local dev server
npx wrangler dev

# The API will be available at http://localhost:8787
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy

# Your worker will be deployed to:
# https://txtoo.your-subdomain.workers.dev
```

## 🗄️ Database Schema

```sql
CREATE TABLE IF NOT EXISTS texts (
    id TEXT PRIMARY KEY,           -- Unique identifier (12 chars, base64url)
    cipher_text TEXT NOT NULL,     -- Encrypted content
    iv TEXT NOT NULL,              -- Initialization vector
    created_at INTEGER NOT NULL,   -- Unix timestamp (seconds)
    expires_at INTEGER NOT NULL    -- Unix timestamp (seconds)
);

CREATE INDEX IF NOT EXISTS idx_expires_at ON texts(expires_at);
```

### Schema Details

- **id**: Cryptographically secure random ID (12 characters, ~72 bits entropy)
- **cipher_text**: Base64url-encoded encrypted data (includes salt)
- **iv**: Base64url-encoded initialization vector for AES-GCM
- **created_at**: Unix timestamp when the record was created
- **expires_at**: Unix timestamp when the record should expire
- **idx_expires_at**: Index for efficient expiration queries

## ⚙️ Configuration

### CORS Settings

Edit `src/index.ts` to configure allowed origins:

```typescript
// Allow all domains (default)
const ALLOW_ORIGINS = ['*'];

// Or specify allowed domains
const ALLOW_ORIGINS = ['localhost', 'txtoo.com', 'yourdomain.com'];
```

The worker automatically:
- Validates origin against allowed list
- Handles subdomain matching (e.g., `app.txtoo.com` matches `txtoo.com`)
- Returns appropriate CORS headers
- Handles preflight OPTIONS requests

### Worker Configuration

Key settings in `wrangler.jsonc`:

```jsonc
{
  "name": "txtoo",                    // Worker name
  "main": "src/index.ts",             // Entry point
  "compatibility_date": "2025-09-27", // Runtime version
  "observability": {
    "enabled": true                   // Enable logs/metrics
  },
  "d1_databases": [...]               // Database binding
}
```

## 🔧 Development Tools

### Local Testing

```bash
# Start dev server with live reload
npx wrangler dev

# Test with local D1 database
npx wrangler dev --local

# View logs
npx wrangler tail
```

### Database Management

```bash
# Execute SQL queries
npx wrangler d1 execute TXToo-db --command="SELECT * FROM texts"

# Run SQL file
npx wrangler d1 execute TXToo-db --file=query.sql

# Export database
npx wrangler d1 export TXToo-db --output=backup.sql
```

### Testing

A test client is included in `test-client.html`:

```bash
# Serve the test client
npx wrangler dev

# Open test-client.html in your browser
# It will test the /api/submit and /api/fetch endpoints
```

## 📊 Monitoring

### Cloudflare Dashboard

Monitor your worker at:
- **Analytics**: https://dash.cloudflare.com → Workers & Pages → txtoo → Metrics
- **Logs**: Use `wrangler tail` or enable Logpush
- **D1 Database**: https://dash.cloudflare.com → D1

### Key Metrics

- Request count and success rate
- Response time (p50, p95, p99)
- Error rate by status code
- D1 query performance
- Worker CPU time

## 🧹 Maintenance

### Cleanup Expired Records

Expired records are automatically deleted when accessed. For proactive cleanup, you can set up a scheduled worker:

```typescript
export default {
  async scheduled(event, env, ctx) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('DELETE FROM texts WHERE expires_at < ?')
      .bind(now)
      .run();
  }
}
```

Add to `wrangler.jsonc`:
```jsonc
"triggers": {
  "crons": ["0 */6 * * *"]  // Run every 6 hours
}
```

## 🔒 Security Best Practices

1. **Never log sensitive data** - The worker doesn't log ciphertext or IVs
2. **Validate all inputs** - All parameters are validated before storage
3. **Use HTTPS only** - Cloudflare Workers enforce HTTPS
4. **Configure CORS carefully** - Restrict origins in production
5. **Monitor for abuse** - Set up rate limiting if needed
6. **Regular updates** - Keep dependencies and runtime updated

## 🚨 Error Handling

The API uses standardized error responses:

| Status | Type | Meaning |
|--------|------|---------|
| 200 | success | Request successful |
| 400 | error | Invalid request parameters |
| 404 | error | Resource not found |
| 410 | error | Resource expired and deleted |
| 500 | error | Internal server error |

All responses follow this format:
```json
{
  "type": "success" | "error" | "info",
  "status": 200,
  "message": "Optional message",
  "data": { /* Response data */ }
}
```

## 📝 Environment Variables

No environment variables are required. Configuration is done through:
- `wrangler.jsonc` for Worker settings
- `src/index.ts` for CORS and business logic

## 🔗 Related Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

## 📄 License

Part of the TXToo project - MIT License

---

**Built with ❤️ using Cloudflare Workers**
