import Database from "better-sqlite3";

import logger from "./logger";

const dbPath = process.env.DB_PATH || "messages.db";
logger.info({ dbPath }, "Initializing database connection");

const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_public_key TEXT NOT NULL,
    to_public_key TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS key_cache (
    fingerprint TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    status TEXT NOT NULL,
    validated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
