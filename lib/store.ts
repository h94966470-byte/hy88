import crypto from "crypto";
import { sql } from "@vercel/postgres";
import { initializeDatabase } from "@/lib/initdb";

async function ensureDatabaseReady() {
  try {
    await initializeDatabase();
  } catch {
    // ignore initialization errors here; the table may already exist
  }
}

type UserRow = {
  id: string;
  username: string;
  password_hash?: string | null;
  image?: string | null;
  provider: string;
  created_at: string | null;
};

export type StoredUser = {
  id: string;
  username: string;
  passwordHash?: string;
  image?: string;
  provider: "credentials";
  createdAt: string;
};

export type StoredWallet = {
  balance: number;
  debt: number;
  dailyClaimDate: string | null;
  newbieStep: number;
  newbieDailyClaimDate: string | null;
  createdAt: string;
};

export type StoredGameRound = {
  result: "tai" | "xiu";
  playerChoice: "tai" | "xiu";
  won: boolean;
};

export type LeaderboardEntry = {
  username: string;
  balance: number;
  rounds: number;
  wins: number;
  losses: number;
  winRate: number;
};

export function hashPassword(value: string) {
  return crypto.createHash("sha256").update(value.trim()).digest("hex");
}

export async function readUsers(): Promise<StoredUser[]> {
  try {
    await ensureDatabaseReady();
    const result = await sql`SELECT * FROM users`;
    const rows = result.rows as UserRow[];

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash ?? undefined,
      image: row.image ?? undefined,
      provider: row.provider as "credentials",
      createdAt: row.created_at ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.error("❌ readUsers error:", error);
    return [];
  }
}

export async function writeUsers(_users: StoredUser[]) {
  console.warn("⚠️ writeUsers is deprecated for PostgreSQL. Use createUser instead.");
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  try {
    await ensureDatabaseReady();
    const result = await sql`
      SELECT * FROM users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as UserRow;
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash ?? undefined,
      image: row.image ?? undefined,
      provider: row.provider as "credentials",
      createdAt: row.created_at ?? new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ findUserByUsername error:", error);
    return null;
  }
}

export async function createUser(user: StoredUser): Promise<StoredUser> {
  try {
    await ensureDatabaseReady();
    await sql`
      INSERT INTO users (id, username, password_hash, image, provider, created_at)
      VALUES (${user.id}, ${user.username}, ${user.passwordHash || null}, ${user.image || null}, ${user.provider}, ${user.createdAt})
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        image = EXCLUDED.image,
        provider = EXCLUDED.provider
    `;
    return user;
  } catch (error) {
    console.error("❌ createUser error:", error);
    throw error;
  }
}

export async function countAccountsByDeviceId(deviceId: string): Promise<number> {
  try {
    await ensureDatabaseReady();
    const result = await sql`
      SELECT COUNT(*) as count FROM device_accounts
      WHERE device_id = ${deviceId}
    `;
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch (error) {
    console.error("❌ countAccountsByDeviceId error:", error);
    return 0;
  }
}

export async function addDeviceAccount(deviceId: string, username: string): Promise<void> {
  try {
    await ensureDatabaseReady();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO device_accounts (id, device_id, username, created_at)
      VALUES (${id}, ${deviceId}, ${username}, ${new Date().toISOString()})
    `;
  } catch (error) {
    console.error("❌ addDeviceAccount error:", error);
  }
}

type WalletRow = {
  balance: string | number;
  debt: string | number;
  daily_claim_date: string | null;
  newbie_step: number;
  newbie_daily_claim_date: string | null;
  created_at: string;
};

const mapWallet = (row: WalletRow): StoredWallet => ({
  balance: Number(row.balance),
  debt: Number(row.debt),
  dailyClaimDate: row.daily_claim_date ? String(row.daily_claim_date).slice(0, 10) : null,
  newbieStep: Number(row.newbie_step),
  newbieDailyClaimDate: row.newbie_daily_claim_date ? String(row.newbie_daily_claim_date).slice(0, 10) : null,
  createdAt: row.created_at,
});

export async function getOrCreateWallet(userId: string): Promise<StoredWallet> {
  await ensureDatabaseReady();
  await sql`
    INSERT INTO user_wallets (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;
  const result = await sql`
    SELECT balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
    FROM user_wallets
    WHERE user_id = ${userId}
  `;
  return mapWallet(result.rows[0] as WalletRow);
}

export async function updateWallet(userId: string, wallet: StoredWallet): Promise<StoredWallet> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET balance = ${wallet.balance},
        debt = ${wallet.debt},
        daily_claim_date = ${wallet.dailyClaimDate},
        newbie_step = ${wallet.newbieStep},
        newbie_daily_claim_date = ${wallet.newbieDailyClaimDate},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  return mapWallet(result.rows[0] as WalletRow);
}

export async function claimDailyWallet(userId: string, dateKey: string): Promise<StoredWallet | null> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET balance = balance + 50000,
        daily_claim_date = ${dateKey},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND (daily_claim_date IS NULL OR daily_claim_date <> ${dateKey})
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  return result.rows.length ? mapWallet(result.rows[0] as WalletRow) : null;
}

export async function claimNewbieWallet(userId: string, dateKey: string): Promise<StoredWallet | null> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET balance = balance + CASE newbie_step
      WHEN 0 THEN 300000
      WHEN 1 THEN 200000
      ELSE 100000
    END,
        newbie_step = newbie_step + 1,
        newbie_daily_claim_date = ${dateKey},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND newbie_step < 7
      AND (newbie_daily_claim_date IS NULL OR newbie_daily_claim_date <> ${dateKey})
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  return result.rows.length ? mapWallet(result.rows[0] as WalletRow) : null;
}

export async function borrowWallet(userId: string): Promise<StoredWallet> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET balance = balance + 50000,
        debt = debt + 50000,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND debt + 50000 <= 2000000
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  if (!result.rows.length) {
    throw new Error("LOAN_LIMIT_REACHED");
  }
  return mapWallet(result.rows[0] as WalletRow);
}

export async function repayWallet(userId: string, amount: number): Promise<StoredWallet> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET balance = balance - ${amount},
        debt = debt - ${amount},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND ${amount} > 0
      AND ${amount} <= balance
      AND ${amount} <= debt
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  if (!result.rows.length) {
    throw new Error("REPAYMENT_INVALID");
  }
  return mapWallet(result.rows[0] as WalletRow);
}

export async function createGameRound(userId: string, round: StoredGameRound): Promise<void> {
  await ensureDatabaseReady();
  await sql`
    INSERT INTO game_rounds (id, user_id, result, player_choice, won)
    VALUES (${crypto.randomUUID()}, ${userId}, ${round.result}, ${round.playerChoice}, ${round.won})
  `;
}

export async function applyGameResult(
  userId: string,
  balanceDelta: number,
  debtDelta: number,
  round: StoredGameRound,
): Promise<StoredWallet> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET balance = balance + ${balanceDelta},
        debt = debt + ${debtDelta},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND balance + ${balanceDelta} >= 0
      AND debt + ${debtDelta} >= 0
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;

  if (!result.rows.length) {
    throw new Error("GAME_WALLET_UPDATE_FAILED");
  }

  await createGameRound(userId, round);
  return mapWallet(result.rows[0] as WalletRow);
}

export async function getRecentGameRounds(limit = 100): Promise<StoredGameRound[]> {
  await ensureDatabaseReady();
  const result = await sql`
    SELECT result, player_choice, won
    FROM game_rounds
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return (result.rows as Array<{ result: "tai" | "xiu"; player_choice: "tai" | "xiu"; won: boolean }>).reverse().map((row) => ({
    result: row.result,
    playerChoice: row.player_choice,
    won: row.won,
  }));
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  await ensureDatabaseReady();
  const result = await sql`
    SELECT
      u.username,
      COALESCE(w.balance, 100000) AS balance,
      COUNT(g.id)::integer AS rounds,
      COUNT(g.id) FILTER (WHERE g.won)::integer AS wins,
      COUNT(g.id) FILTER (WHERE NOT g.won)::integer AS losses
    FROM users u
    LEFT JOIN user_wallets w ON w.user_id = u.id
    LEFT JOIN game_rounds g ON g.user_id = u.id
    GROUP BY u.id, u.username, w.balance
    ORDER BY COALESCE(w.balance, 100000) DESC, wins DESC, u.username ASC
    LIMIT ${limit}
  `;

  return (result.rows as Array<{ username: string; balance: string | number; rounds: string | number; wins: string | number; losses: string | number }>).map((row) => {
    const rounds = Number(row.rounds);
    const wins = Number(row.wins);
    return {
      username: row.username,
      balance: Number(row.balance),
      rounds,
      wins,
      losses: Number(row.losses),
      winRate: rounds ? Math.round((wins / rounds) * 1000) / 10 : 0,
    };
  });
}
