import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createGameRound, getRecentGameRounds } from "@/lib/store";

const getUserId = async () => {
  const session = await getServerSession(authOptions);
  return session?.user && "id" in session.user ? String(session.user.id) : null;
};

export async function GET() {
  if (!(await getUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ rounds: await getRecentGameRounds() });
  } catch (error) {
    console.error("Get game rounds error:", error);
    return NextResponse.json({ error: "Không thể tải lịch sử ván chơi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId || userId === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { result?: string; playerChoice?: string; won?: boolean };
    if (!["tai", "xiu"].includes(body.result || "") || !["tai", "xiu"].includes(body.playerChoice || "") || typeof body.won !== "boolean") {
      return NextResponse.json({ error: "Dữ liệu ván chơi không hợp lệ" }, { status: 400 });
    }

    await createGameRound(userId, {
      result: body.result as "tai" | "xiu",
      playerChoice: body.playerChoice as "tai" | "xiu",
      won: body.won,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Create game round error:", error);
    return NextResponse.json({ error: "Không thể lưu ván chơi" }, { status: 500 });
  }
}