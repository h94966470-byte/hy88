import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { borrowWallet, claimDailyWallet, claimNewbieWallet, getOrCreateWallet, repayWallet, StoredWallet, updateWallet } from "@/lib/store";

const getUserId = async () => {
  const session = await getServerSession(authOptions);
  return session?.user && "id" in session.user ? String(session.user.id) : null;
};

export async function GET() {
  const userId = await getUserId();
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ wallet: await getOrCreateWallet(userId) });
  } catch (error) {
    console.error("Get wallet error:", error);
    return NextResponse.json({ error: "Không thể tải số dư" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<StoredWallet>;
    const current = await getOrCreateWallet(userId);
    const nextWallet: StoredWallet = {
      balance: Number(body.balance),
      debt: Number(body.debt),
      winStreak: current.winStreak,
      lossStreak: current.lossStreak,
      dailyClaimDate: body.dailyClaimDate ?? current.dailyClaimDate,
      newbieStep: Number(body.newbieStep),
      newbieDailyClaimDate: body.newbieDailyClaimDate ?? current.newbieDailyClaimDate,
      createdAt: current.createdAt,
    };

    if (!Number.isSafeInteger(nextWallet.balance) || nextWallet.balance < 0 ||
        !Number.isSafeInteger(nextWallet.debt) || nextWallet.debt < 0 ||
        !Number.isSafeInteger(nextWallet.newbieStep) || nextWallet.newbieStep < 0) {
      return NextResponse.json({ error: "Dữ liệu ví không hợp lệ" }, { status: 400 });
    }

    return NextResponse.json({ wallet: await updateWallet(userId, nextWallet) });
  } catch (error) {
    console.error("Update wallet error:", error);
    return NextResponse.json({ error: "Không thể cập nhật số dư" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { action?: string; dateKey?: string; amount?: number };
    if (body.action === "borrow") {
      try {
        return NextResponse.json({ wallet: await borrowWallet(userId) });
      } catch (error) {
        if (error instanceof Error && error.message === "LOAN_LIMIT_REACHED") {
          return NextResponse.json({ error: "Khoản nợ đã đạt giới hạn 2.000.000 VND, không thể vay thêm." }, { status: 409 });
        }
        throw error;
      }
    }

    if (body.action === "repay") {
      const amount = Number(body.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return NextResponse.json({ error: "Số tiền trả nợ không hợp lệ" }, { status: 400 });
      }
      try {
        return NextResponse.json({ wallet: await repayWallet(userId, amount) });
      } catch (error) {
        if (error instanceof Error && error.message === "REPAYMENT_INVALID") {
          return NextResponse.json({ error: "Số tiền trả không được vượt quá số dư hoặc khoản nợ." }, { status: 409 });
        }
        throw error;
      }
    }

    if (!body.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)) {
      return NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 });
    }

    const wallet = body.action === "daily"
      ? await claimDailyWallet(userId, body.dateKey)
      : body.action === "newbie"
        ? await claimNewbieWallet(userId, body.dateKey)
        : null;

    if (!wallet) {
      return NextResponse.json({ error: "Daily đã được nhận hôm nay hoặc không còn hiệu lực" }, { status: 409 });
    }

    return NextResponse.json({ wallet });
  } catch (error) {
    console.error("Claim wallet bonus error:", error);
    return NextResponse.json({ error: "Không thể đồng bộ dữ liệu" }, { status: 500 });
  }
}