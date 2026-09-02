import { sql } from "@vercel/postgres";

const dbConnectionHint =
  "Database chưa được cấu hình. Hãy thêm biến môi trường POSTGRES_URL hoặc DATABASE_URL trong Vercel hoặc .env.local.";

export async function initializeDatabase() {
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(dbConnectionHint);
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        image VARCHAR(255),
        provider VARCHAR(50) NOT NULL DEFAULT 'credentials',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS device_accounts (
        id UUID PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_device_accounts_device_id ON device_accounts(device_id);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_wallets (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance BIGINT NOT NULL DEFAULT 100000,
        debt BIGINT NOT NULL DEFAULT 0,
        daily_claim_date DATE,
        newbie_step INTEGER NOT NULL DEFAULT 0,
        newbie_daily_claim_date DATE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_wallets_updated_at ON user_wallets(updated_at);
    `;

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
}
