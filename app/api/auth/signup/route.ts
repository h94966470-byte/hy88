import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByUsername, hashPassword } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();

  if (!username || !password) {
    return NextResponse.json({ error: "Thiếu username hoặc mật khẩu" }, { status: 400 });
  }

  if (username.length < 3) {
    return NextResponse.json({ error: "Username tối thiểu 3 ký tự" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự" }, { status: 400 });
  }

  const existing = await findUserByUsername(username);
  if (existing) {
    return NextResponse.json({ error: "Username đã tồn tại" }, { status: 409 });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hashPassword(password),
    provider: "credentials" as const,
    createdAt: new Date().toISOString(),
  };

  await createUser(user);

  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
