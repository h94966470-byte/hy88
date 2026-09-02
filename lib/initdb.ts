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

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
}
