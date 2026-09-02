import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveDiceBet } from "@/lib/store";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user && "id" in session.user ? String(session.user.id) : null;
  if (!sessionUserId || sessionUserId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { userId?: unknown; betAmount?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const betAmount = body.betAmount;

    if (userId !== sessionUserId) {
      return NextResponse.json({ error: "User không hợp lệ" }, { status: 403 });
    }
    if (typeof betAmount !== "number" || !Number.isSafeInteger(betAmount) || betAmount <= 0) {
      return NextResponse.json({ error: "Số tiền cược không hợp lệ" }, { status: 400 });
    }

    return NextResponse.json(await resolveDiceBet(sessionUserId, betAmount));
  } catch (error) {
    console.error("Resolve dice bet error:", error);
    if (error instanceof Error && error.message === "INVALID_BET_AMOUNT") {
      return NextResponse.json({ error: "Số tiền cược không hợp lệ hoặc số dư không đủ" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "DICE_WALLET_UPDATE_FAILED") {
      return NextResponse.json({ error: "Số dư đã thay đổi, vui lòng thử lại" }, { status: 409 });
    }
    return NextResponse.json({ error: "Không thể xử lý ván chơi" }, { status: 500 });
  }
}