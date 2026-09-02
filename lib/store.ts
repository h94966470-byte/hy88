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
