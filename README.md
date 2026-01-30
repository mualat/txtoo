# 🔏 TXToo

**Secure Text Share - Encrypted in your browser, ephemeral by design.**

TXToo is a zero-knowledge, end-to-end encrypted text sharing application. All encryption happens client-side in your browser, ensuring that your sensitive data never touches the server in plain text. Built with React and powered by Cloudflare Workers with D1 database for secure, ephemeral storage.

## 🔐 Security Features

- **Client-Side Encryption**: All encryption/decryption happens in your browser using the Web Crypto API
- **Zero-Knowledge Architecture**: The server only stores encrypted data and has no access to your content
- **AES-GCM Encryption**: Industry-standard 256-bit AES-GCM encryption with PBKDF2 key derivation
- **Ephemeral by Design**: All notes automatically expire based on your chosen TTL (Time To Live)
- **URL-Safe Sharing**: Encryption key is embedded in the URL fragment for easy sharing

## ✨ Features

- 🔒 **End-to-end encryption** with AES-256-GCM
- ⏱️ **Flexible expiration times** (3 mins to 30 days)
- 📱 **QR code generation** for easy mobile sharing
- 🎨 **Dark, minimalist UI** with block-style design
- 🚀 **Fast and lightweight** - built with Vite + React
- 🌍 **Global CDN** - powered by Cloudflare Workers
- 🔑 **Auto-generated passwords** or bring your own
- 📋 **One-click copy** to clipboard

## 🏗️ Architecture

### Frontend (`/src`)
- **React 18** with TypeScript
- **Vite** for blazing-fast development
- **TailwindCSS** for styling
- **React Router** for client-side routing
- **QRCode.js** for QR code generation
- **Lucide React** for icons

### Backend (`/workers`)
- **Cloudflare Workers** for serverless API
- **D1 Database** for encrypted data storage
- **CORS-enabled** API endpoints
- **Automatic expiration** handling

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account (for Workers deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mualat/txtoo.git
   cd TXToo
   ```

2. **Install frontend dependencies**
   ```bash
   pnpm install
   ```

3. **Install worker dependencies**
   ```bash
   cd workers
   pnpm install
   cd ..
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```env
   VITE_WORKERS_URL=https://your-worker.workers.dev/api
   VITE_SITE_NAME=TXToo
   ```

### Development

1. **Start the frontend dev server**
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:5173`

2. **Start the Cloudflare Worker locally** (in a separate terminal)
   ```bash
   cd workers
   npx wrangler dev
   ```

### Cloudflare Workers Setup

1. **Create a D1 database**
   ```bash
   cd workers
   npx wrangler d1 create TXToo-db
   ```

2. **Update `wrangler.jsonc`** with your database ID

3. **Initialize the database schema**
   ```bash
   npx wrangler d1 execute TXToo-db --file=schema.sql
   ```

4. **Deploy the worker**
   ```bash
   npx wrangler deploy
   ```

5. **Update your `.env`** with the deployed worker URL

## 📡 API Endpoints

### `POST /api/submit`
Submit encrypted text for storage.

**Request Body:**
```json
{
  "ttl": 86400,
  "cipherText": "base64url-encoded-encrypted-data",
  "iv": "base64url-encoded-iv"
}
```

**Response:**
```json
{
  "type": "success",
  "status": 200,
  "data": {
    "id": "unique-id",
    "url": "https://your-domain.com/unique-id",
    "expiresAt": 1234567890
  }
}
```

### `GET /api/fetch/{id}`
Retrieve encrypted text by ID.

**Response:**
```json
{
  "type": "success",
  "status": 200,
  "data": {
    "id": "unique-id",
    "cipher_text": "base64url-encoded-encrypted-data",
    "iv": "base64url-encoded-iv",
    "expiresAt": 1234567890
  }
}
```

## 🔧 Configuration

### Time to Live (TTL) Options
- 3 Minutes (180s)
- 10 Minutes (600s)
- 30 Minutes (1800s)
- 1 Hour (3600s)
- 6 Hours (21600s)
- 12 Hours (43200s)
- 24 Hours (86400s) - **Default**
- 7 Days (604800s)
- 30 Days (2592000s)

### CORS Configuration
Edit `workers/src/index.ts` to configure allowed origins:

```typescript
// Allow all domains
const ALLOW_ORIGINS = ['*'];

// Or specify allowed domains
const ALLOW_ORIGINS = ['localhost', 'yourdomain.com'];
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | TailwindCSS |
| Routing | React Router v7 |
| Encryption | Web Crypto API (AES-GCM) |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| QR Codes | qrcode.js |
| Icons | Lucide React |

## 📦 Project Structure

```
TXToo/
├── src/                    # Frontend source code
│   ├── App.tsx            # Main app component with routing
│   ├── Home.tsx           # Home page with encryption UI
│   ├── ViewNote.tsx       # Note viewing/decryption page
│   ├── utils/
│   │   └── crypto.ts      # Encryption/decryption utilities
│   └── main.tsx           # App entry point
├── workers/               # Cloudflare Worker backend
│   ├── src/
│   │   └── index.ts       # Worker API endpoints
│   ├── schema.sql         # D1 database schema
│   └── wrangler.jsonc     # Worker configuration
├── public/                # Static assets
└── package.json           # Frontend dependencies
```

## 🔒 How It Works

1. **Encryption Flow**:
   - User enters text and optionally sets a password
   - Text is encrypted client-side using AES-GCM with a derived key (PBKDF2)
   - Encrypted data + IV are sent to the Cloudflare Worker
   - Worker stores encrypted data in D1 database with expiration time
   - User receives a shareable URL with the encryption key embedded

2. **Decryption Flow**:
   - User opens the share URL (format: `/{id}~{key}`)
   - Frontend fetches encrypted data from the Worker
   - Data is decrypted client-side using the key from the URL
   - Decrypted text is displayed to the user

3. **Security Model**:
   - The server never sees the encryption key (it's in the URL fragment)
   - All encryption/decryption happens in the browser
   - Data automatically expires and is deleted from the database
   - No user accounts or tracking

## 🚀 Deployment

### Frontend (Cloudflare Pages)
```bash
pnpm build
npx wrangler pages deploy dist
```

### Backend (Cloudflare Workers)
```bash
cd workers
npx wrangler deploy
```

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Security Notice

While TXToo uses industry-standard encryption, remember:
- Anyone with the share URL can decrypt the note
- URLs may be logged by browsers, proxies, or analytics
- For maximum security, use a custom password and share it separately
- This is designed for temporary, ephemeral sharing - not long-term storage

## 🙏 Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Inspired by services like PrivateBin and Pastebin
- Icons by [Lucide](https://lucide.dev/)
