import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { adjustWalletBalance, getAdminUsers } from "@/lib/store";

const getAdminSession = async () => {
  const session = await getServerSession(authOptions);
  return session?.user && "role" in session.user && session.user.role === "admin" ? session : null;
};

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ users: await getAdminUsers() });
  } catch (error) {
    console.error("Get admin users error:", error);
    return NextResponse.json({ error: "Không thể tải danh sách tài khoản" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = (await req.json()) as { userId?: string; amount?: number };
    const amount = Number(body.amount);
    if (!body.userId || !Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1000000000) {
      return NextResponse.json({ error: "Số tiền điều chỉnh không hợp lệ" }, { status: 400 });
    }

    const wallet = await adjustWalletBalance(body.userId, amount);
    return NextResponse.json({ wallet });
  } catch (error) {
    if (error instanceof Error && error.message === "BALANCE_WOULD_BE_NEGATIVE") {
      return NextResponse.json({ error: "Không thể trừ vượt quá số dư hiện tại" }, { status: 409 });
    }
    console.error("Adjust admin wallet error:", error);
    return NextResponse.json({ error: "Không thể cập nhật số dư" }, { status: 500 });
  }
}
