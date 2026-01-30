-- Encrypted text storage table
CREATE TABLE IF NOT EXISTS texts (
    id TEXT PRIMARY KEY,
    cipher_text TEXT NOT NULL,
    iv TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_expires_at ON texts(expires_at);
