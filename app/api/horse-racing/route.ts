import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getHorseRaceCard, horseBetTypes, type HorseBetType } from "@/lib/horse-racing";
import { resolveHorseRaceBet } from "@/lib/store";

const getUserId = async () => {
  const session = await getServerSession(authOptions);
  return session?.user && "id" in session.user ? String(session.user.id) : null;
};

const isValidRaceNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raceNumber = Number(request.nextUrl.searchParams.get("race") ?? 5);
  if (!isValidRaceNumber(raceNumber)) {
    return NextResponse.json({ error: "Số cuộc đua không hợp lệ" }, { status: 400 });
  }

  try {
    return NextResponse.json({ race: getHorseRaceCard(raceNumber) });
  } catch (error) {
    console.error("Get horse racing card error:", error);
    return NextResponse.json({ error: "Không thể tải thông tin cuộc đua" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      raceNumber?: unknown;
      amount?: unknown;
      betType?: unknown;
      horseNumber?: unknown;
    };
    const validBetType = horseBetTypes.some((bet) => bet.value === body.betType);
    if (!isValidRaceNumber(body.raceNumber) ||
        typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) || body.amount <= 0 ||
        !validBetType ||
        typeof body.horseNumber !== "number" || !Number.isInteger(body.horseNumber) ||
        body.horseNumber < 1 || body.horseNumber > 5) {
      return NextResponse.json({ error: "Thông tin cược đua ngựa không hợp lệ" }, { status: 400 });
    }

    const race = getHorseRaceCard(body.raceNumber);
    const result = await resolveHorseRaceBet(
      userId,
      body.amount,
      body.betType as HorseBetType,
      body.horseNumber,
      race,
    );
    return NextResponse.json({ ...result, race });
  } catch (error) {
    console.error("Resolve horse racing bet error:", error);
    if (error instanceof Error && error.message === "INVALID_HORSE_RACE_BET") {
      return NextResponse.json({ error: "Số tiền cược không hợp lệ hoặc số dư không đủ" }, { status: 409 });
    }
    return NextResponse.json({ error: "Không thể xử lý cược đua ngựa" }, { status: 500 });
  }
}
