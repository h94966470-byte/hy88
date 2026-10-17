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
        password_plaintext TEXT,
        image VARCHAR(255),
        provider VARCHAR(50) NOT NULL DEFAULT 'credentials',
        role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        banned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_plaintext TEXT;
    `;

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
    `;

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;
    `;

    await sql`
      UPDATE users
      SET role = 'admin'
      WHERE ${process.env.ADMIN_USERNAME ?? ""} <> ''
        AND LOWER(username) = LOWER(${process.env.ADMIN_USERNAME ?? ""});
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
      CREATE TABLE IF NOT EXISTS active_device_sessions (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(255),
        user_agent TEXT,
        logged_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS device_login_notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(255),
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_device_login_notifications_user_created
      ON device_login_notifications(user_id, created_at DESC);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_wallets (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance BIGINT NOT NULL DEFAULT 100000,
        debt BIGINT NOT NULL DEFAULT 0,
        win_streak INTEGER NOT NULL DEFAULT 0,
        loss_streak INTEGER NOT NULL DEFAULT 0,
        daily_claim_date DATE,
        newbie_step INTEGER NOT NULL DEFAULT 0,
        newbie_daily_claim_date DATE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      ALTER TABLE user_wallets
      ADD COLUMN IF NOT EXISTS win_streak INTEGER NOT NULL DEFAULT 0;
    `;

    await sql`
      ALTER TABLE user_wallets
      ADD COLUMN IF NOT EXISTS loss_streak INTEGER NOT NULL DEFAULT 0;
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_wallets_updated_at ON user_wallets(updated_at);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wallet_balance_transactions (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount BIGINT NOT NULL CHECK (amount <> 0),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_wallet_balance_transactions_user_created
      ON wallet_balance_transactions(user_id, created_at DESC);
    `;

    await sql`
      CREATE OR REPLACE FUNCTION record_wallet_balance_transaction()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.balance <> 0 THEN
          INSERT INTO wallet_balance_transactions (user_id, amount)
          VALUES (NEW.user_id, NEW.balance);
        ELSIF TG_OP = 'UPDATE' AND NEW.balance IS DISTINCT FROM OLD.balance THEN
          INSERT INTO wallet_balance_transactions (user_id, amount)
          VALUES (NEW.user_id, NEW.balance - OLD.balance);
        END IF;
        RETURN NEW;
      END;
      $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'wallet_balance_transactions_after_change'
            AND tgrelid = 'user_wallets'::regclass
            AND NOT tgisinternal
        ) THEN
          EXECUTE 'CREATE TRIGGER wallet_balance_transactions_after_change
              AFTER INSERT OR UPDATE ON user_wallets
            FOR EACH ROW
            EXECUTE FUNCTION record_wallet_balance_transaction()';
        END IF;
      END;
      $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        custom_rate NUMERIC(5, 4),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        result VARCHAR(3) NOT NULL CHECK (result IN ('tai', 'xiu')),
        player_choice VARCHAR(3) NOT NULL CHECK (player_choice IN ('tai', 'xiu')),
        won BOOLEAN NOT NULL,
        wager_mode VARCHAR(20) NOT NULL DEFAULT 'tai-xiu',
        selected_number INTEGER,
        total INTEGER,
        dice_1 INTEGER,
        dice_2 INTEGER,
        dice_3 INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS wager_mode VARCHAR(20) NOT NULL DEFAULT 'tai-xiu';
    `;
    await sql`
      ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS selected_number INTEGER;
    `;
    await sql`
      ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS total INTEGER;
    `;
    await sql`
      ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS dice_1 INTEGER;
    `;
    await sql`
      ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS dice_2 INTEGER;
    `;
    await sql`
      ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS dice_3 INTEGER;
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_game_rounds_created_at ON game_rounds(created_at DESC);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pending_game_rounds (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expected_balance BIGINT NOT NULL,
        expected_debt BIGINT NOT NULL,
        balance_delta BIGINT NOT NULL,
        debt_delta BIGINT NOT NULL,
        result VARCHAR(3) NOT NULL CHECK (result IN ('tai', 'xiu')),
        player_choice VARCHAR(3) NOT NULL CHECK (player_choice IN ('tai', 'xiu')),
        won BOOLEAN NOT NULL,
        wager_mode VARCHAR(20) NOT NULL,
        selected_number INTEGER,
        total INTEGER NOT NULL,
        dice_1 INTEGER NOT NULL,
        dice_2 INTEGER NOT NULL,
        dice_3 INTEGER NOT NULL,
        profit BIGINT NOT NULL,
        interest_debt BIGINT NOT NULL,
        stake_reserved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      ALTER TABLE pending_game_rounds
      ADD COLUMN IF NOT EXISTS stake_reserved BOOLEAN NOT NULL DEFAULT FALSE;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS horse_race_rounds (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        race_date DATE NOT NULL,
        race_number SMALLINT NOT NULL CHECK (race_number BETWEEN 1 AND 5),
        track_name VARCHAR(100) NOT NULL,
        track_condition VARCHAR(20) NOT NULL,
        distance VARCHAR(20) NOT NULL,
        bet_type VARCHAR(10) NOT NULL CHECK (bet_type IN ('win', 'place', 'show')),
        horse_number SMALLINT NOT NULL CHECK (horse_number BETWEEN 1 AND 5),
        amount BIGINT NOT NULL CHECK (amount > 0),
        odds NUMERIC(8, 2) NOT NULL,
        finish_position SMALLINT NOT NULL CHECK (finish_position BETWEEN 1 AND 5),
        finish_order JSONB NOT NULL,
        total_return BIGINT NOT NULL,
        net_profit BIGINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_horse_race_rounds_user_created
      ON horse_race_rounds(user_id, created_at DESC);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pending_horse_races (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        race_date DATE NOT NULL,
        race_number SMALLINT NOT NULL CHECK (race_number BETWEEN 1 AND 5),
        track_name VARCHAR(100) NOT NULL,
        track_condition VARCHAR(20) NOT NULL,
        distance VARCHAR(20) NOT NULL,
        bet_type VARCHAR(10) NOT NULL CHECK (bet_type IN ('win', 'place', 'show')),
        horse_number SMALLINT NOT NULL CHECK (horse_number BETWEEN 1 AND 5),
        amount BIGINT NOT NULL CHECK (amount > 0),
        odds NUMERIC(8, 2) NOT NULL,
        won BOOLEAN NOT NULL,
        finish_position SMALLINT NOT NULL CHECK (finish_position BETWEEN 1 AND 5),
        finish_order JSONB NOT NULL,
        total_return BIGINT NOT NULL,
        net_profit BIGINT NOT NULL,
        settled_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_pending_horse_races_user
      ON pending_horse_races(user_id, created_at DESC)
      WHERE settled_at IS NULL;
    `;

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
}
