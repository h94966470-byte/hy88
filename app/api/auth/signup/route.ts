import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByUsername, hashPassword, countAccountsByDeviceId, addDeviceAccount } from "@/lib/store";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(req, "1/hour");
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.retryAfter, "Bạn chỉ có thể đăng ký 1 tài khoản mỗi giờ từ IP này.");
  }

  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "").trim();
    const deviceId = String(body?.deviceId || "").trim();
    const isConfiguredAdmin = Boolean(
      process.env.ADMIN_USERNAME &&
      process.env.ADMIN_USERNAME.toLowerCase() === username.toLowerCase(),
    );

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

    if (deviceId && !isConfiguredAdmin) {
      const accountCount = await countAccountsByDeviceId(deviceId);
      if (accountCount >= 3) {
        return NextResponse.json({ error: "Thiết bị này đã tạo tối đa 3 tài khoản. Không thể tạo thêm." }, { status: 429 });
      }
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(password),
      provider: "credentials" as const,
      role: "user" as const,
      createdAt: new Date().toISOString(),
    };

    await createUser(user);
    
    if (deviceId) {
      await addDeviceAccount(deviceId, username);
    }

    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error("Signup error:", error);

    const message =
      error instanceof Error &&
      (error.message.includes("missing_connection_string") ||
        error.message.includes("Database chưa được cấu hình") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("connect"))
        ? "Database chưa được cấu hình. Hãy thêm biến môi trường POSTGRES_URL hoặc DATABASE_URL trong Vercel hoặc .env.local."
        : "Đăng ký thất bại vì lỗi server.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
