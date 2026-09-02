import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { applyGameResult, getGameRoundCount, getRecentGameRounds, StoredGameRound } from "@/lib/store";

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
    const body = (await req.json()) as { result?: string; playerChoice?: string; won?: boolean; balanceDelta?: number; debtDelta?: number; wagerMode?: string; selectedNumber?: number | null; total?: number; dice?: number[] };
    const { balanceDelta, debtDelta } = body;
    if (!["tai", "xiu"].includes(body.result || "") || !["tai", "xiu"].includes(body.playerChoice || "") || typeof body.won !== "boolean" ||
      typeof balanceDelta !== "number" || typeof debtDelta !== "number" || !Number.isSafeInteger(balanceDelta) ||
        !Number.isSafeInteger(debtDelta) || debtDelta < 0 ||
        !["tai-xiu", "triple", "pair", "total", "single"].includes(body.wagerMode || "") ||
        !Number.isSafeInteger(body.total) || !Array.isArray(body.dice) || body.dice.length !== 3 ||
        !body.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6)) {
      return NextResponse.json({ error: "Dữ liệu ván chơi không hợp lệ" }, { status: 400 });
    }

    const wallet = await applyGameResult(userId, balanceDelta, debtDelta, {
      result: body.result as "tai" | "xiu",
      playerChoice: body.playerChoice as "tai" | "xiu",
      won: body.won,
      wagerMode: body.wagerMode as StoredGameRound["wagerMode"],
      selectedNumber: body.selectedNumber ?? null,
      total: body.total as number,
      dice: body.dice as number[],
    });
    return NextResponse.json({ ok: true, wallet });
  } catch (error) {
    console.error("Create game round error:", error);
    if (error instanceof Error && error.message === "GAME_WALLET_UPDATE_FAILED") {
      return NextResponse.json({ error: "Không thể cập nhật số dư cho ván chơi" }, { status: 409 });
    }
    return NextResponse.json({ error: "Không thể lưu ván chơi" }, { status: 500 });
  }
}