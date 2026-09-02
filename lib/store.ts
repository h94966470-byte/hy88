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
  role?: "user" | "admin" | null;
  banned?: boolean | null;
  created_at: string | null;
};

export type StoredUser = {
  id: string;
  username: string;
  passwordHash?: string;
  image?: string;
  provider: "credentials";
  role: "user" | "admin";
  banned: boolean;
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
  wagerMode: "tai-xiu" | "triple" | "pair" | "total" | "single";
  selectedNumber: number | null;
  total: number;
  dice: number[];
};

export type LeaderboardEntry = {
  username: string;
  balance: number;
  rounds: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type AdminUserEntry = {
  id: string;
  username: string;
  role: "user" | "admin";
  balance: number;
  debt: number;
  rounds: number;
  wins: number;
  losses: number;
  banned: boolean;
};

export type GameStats = {
  total: number;
  wins: number;
  losses: number;
  tai: number;
  xiu: number;
  triple: number;
  pair: number;
  totalBet: number;
  single: number;
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
      role: row.role === "admin" ? "admin" : "user",
      banned: Boolean(row.banned),
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
      role: row.role === "admin" ? "admin" : "user",
      banned: Boolean(row.banned),
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
    const role = process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME.toLowerCase() === user.username.toLowerCase()
      ? "admin"
      : user.role;
    await sql`
      INSERT INTO users (id, username, password_hash, image, provider, role, banned, created_at)
      VALUES (${user.id}, ${user.username}, ${user.passwordHash || null}, ${user.image || null}, ${user.provider}, ${role}, ${user.banned}, ${user.createdAt})
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        image = EXCLUDED.image,
        provider = EXCLUDED.provider,
        role = CASE WHEN users.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END
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
    INSERT INTO game_rounds (id, user_id, result, player_choice, won, wager_mode, selected_number, total, dice_1, dice_2, dice_3)
    VALUES (${crypto.randomUUID()}, ${userId}, ${round.result}, ${round.playerChoice}, ${round.won}, ${round.wagerMode}, ${round.selectedNumber}, ${round.total}, ${round.dice[0]}, ${round.dice[1]}, ${round.dice[2]})
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

export async function getRecentGameRounds(limit = 30): Promise<StoredGameRound[]> {
  await ensureDatabaseReady();
  const result = await sql`
    SELECT result, player_choice, won, wager_mode, selected_number, total, dice_1, dice_2, dice_3
    FROM game_rounds
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return (result.rows as Array<{ result: "tai" | "xiu"; player_choice: "tai" | "xiu"; won: boolean; wager_mode: StoredGameRound["wagerMode"]; selected_number: number | null; total: number | null; dice_1: number | null; dice_2: number | null; dice_3: number | null }>).reverse().map((row) => ({
    result: row.result,
    playerChoice: row.player_choice,
    won: row.won,
    wagerMode: row.wager_mode,
    selectedNumber: row.selected_number,
    total: row.total ?? 0,
    dice: [row.dice_1 ?? 0, row.dice_2 ?? 0, row.dice_3 ?? 0],
  }));
}

export async function getGameRoundCount(): Promise<number> {
  await ensureDatabaseReady();
  const result = await sql`SELECT COUNT(*)::integer AS count FROM game_rounds`;
  return Number((result.rows[0] as { count: string | number }).count);
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

export async function getAdminUsers(): Promise<AdminUserEntry[]> {
  await ensureDatabaseReady();
  const result = await sql`
    SELECT u.id, u.username, u.role, u.banned,
      COALESCE(w.balance, 100000) AS balance,
      COALESCE(w.debt, 0) AS debt,
      COUNT(g.id)::integer AS rounds,
      COUNT(g.id) FILTER (WHERE g.won)::integer AS wins,
      COUNT(g.id) FILTER (WHERE NOT g.won)::integer AS losses
    FROM users u
    LEFT JOIN user_wallets w ON w.user_id = u.id
    LEFT JOIN game_rounds g ON g.user_id = u.id
    GROUP BY u.id, u.username, u.role, u.banned, w.balance, w.debt
    ORDER BY COALESCE(w.balance, 100000) DESC, u.username ASC
  `;
  return (result.rows as Array<{ id: string; username: string; role: string; banned: boolean; balance: string | number; debt: string | number; rounds: string | number; wins: string | number; losses: string | number }>).map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role === "admin" ? "admin" : "user",
    balance: Number(row.balance),
    debt: Number(row.debt),
    rounds: Number(row.rounds),
    wins: Number(row.wins),
    losses: Number(row.losses),
    banned: Boolean(row.banned),
  }));
}

export async function adjustWalletBalance(userId: string, amount: number): Promise<StoredWallet> {
  await ensureDatabaseReady();
  const result = await sql`
    INSERT INTO user_wallets (user_id, balance)
    VALUES (${userId}, GREATEST(0, 100000 + ${amount}))
    ON CONFLICT (user_id) DO UPDATE
      SET balance = user_wallets.balance + ${amount}, updated_at = CURRENT_TIMESTAMP
      WHERE user_wallets.balance + ${amount} >= 0
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  if (!result.rows.length) throw new Error("BALANCE_WOULD_BE_NEGATIVE");
  return mapWallet(result.rows[0] as WalletRow);
}

export async function setUserBanned(userId: string, banned: boolean): Promise<void> {
  await ensureDatabaseReady();
  await sql`UPDATE users SET banned = ${banned} WHERE id = ${userId}`;
}

export async function adjustWalletDebt(userId: string, amount: number): Promise<StoredWallet> {
  await ensureDatabaseReady();
  const result = await sql`
    UPDATE user_wallets
    SET debt = debt + ${amount}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND debt + ${amount} >= 0
    RETURNING balance, debt, daily_claim_date, newbie_step, newbie_daily_claim_date, created_at
  `;
  if (!result.rows.length) throw new Error("DEBT_WOULD_BE_NEGATIVE");
  return mapWallet(result.rows[0] as WalletRow);
}

export async function getGameStats(): Promise<GameStats> {
  await ensureDatabaseReady();
  const result = await sql`
    SELECT COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE won)::integer AS wins,
      COUNT(*) FILTER (WHERE NOT won)::integer AS losses,
      COUNT(*) FILTER (WHERE result = 'tai')::integer AS tai,
      COUNT(*) FILTER (WHERE result = 'xiu')::integer AS xiu,
      COUNT(*) FILTER (WHERE wager_mode = 'triple')::integer AS triple,
      COUNT(*) FILTER (WHERE wager_mode = 'pair')::integer AS pair,
      COUNT(*) FILTER (WHERE wager_mode = 'total')::integer AS total_bet,
      COUNT(*) FILTER (WHERE wager_mode = 'single')::integer AS single
    FROM game_rounds
  `;
  const row = result.rows[0] as Record<string, string | number>;
  return {
    total: Number(row.total), wins: Number(row.wins), losses: Number(row.losses),
    tai: Number(row.tai), xiu: Number(row.xiu), triple: Number(row.triple),
    pair: Number(row.pair), totalBet: Number(row.total_bet), single: Number(row.single),
  };
}
