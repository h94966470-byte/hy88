import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getGameRoundCount, getRecentGameRounds, resolveGameRound, StoredGameRound } from "@/lib/store";

const getUserId = async () => {
  const session = await getServerSession(authOptions);
  return session?.user && "id" in session.user ? String(session.user.id) : null;
};

export async function GET() {
  if (!(await getUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [rounds, totalRounds] = await Promise.all([getRecentGameRounds(), getGameRoundCount()]);
    return NextResponse.json({ rounds, totalRounds });
  } catch (error) {
    console.error("Get game rounds error:", error);
    return NextResponse.json({ error: "Không thể tải lịch sử ván chơi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId || userId === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { amount?: number; betType?: string; wagerMode?: string; selectedNumber?: number | null; playerChoice?: string | null };
    const amount = body.amount;
    const selectedNumber = body.selectedNumber;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 ||
      !["custom", "half", "all"].includes(body.betType || "") ||
      !["tai-xiu", "triple", "pair", "total", "single"].includes(body.wagerMode || "") ||
      (body.wagerMode === "tai-xiu" && !["tai", "xiu"].includes(body.playerChoice || "")) ||
      (body.wagerMode !== "tai-xiu" && body.playerChoice !== null && body.playerChoice !== undefined) ||
      (body.wagerMode === "total" && (typeof selectedNumber !== "number" || !Number.isInteger(selectedNumber) || selectedNumber < 4 || selectedNumber > 17)) ||
      (body.wagerMode !== "total" && body.wagerMode !== "tai-xiu" && (typeof selectedNumber !== "number" || !Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > 6))) {
      return NextResponse.json({ error: "Dữ liệu ván chơi không hợp lệ" }, { status: 400 });
    }

    const game = await resolveGameRound(userId, amount, body.betType as "custom" | "half" | "all", body.wagerMode as StoredGameRound["wagerMode"], selectedNumber ?? null, body.playerChoice as "tai" | "xiu" | null);
    return NextResponse.json({ ok: true, wallet: game.wallet, round: game.round, profit: game.profit, interestDebt: game.interestDebt });
  } catch (error) {
    console.error("Create game round error:", error);
    if (error instanceof Error && error.message === "GAME_WALLET_UPDATE_FAILED") {
      return NextResponse.json({ error: "Không thể cập nhật số dư cho ván chơi" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INVALID_BET_AMOUNT") {
      return NextResponse.json({ error: "Số tiền cược không hợp lệ hoặc số dư đã thay đổi" }, { status: 409 });
    }
    return NextResponse.json({ error: "Không thể lưu ván chơi" }, { status: 500 });
  }
}