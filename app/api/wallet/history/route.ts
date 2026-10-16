import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getBalanceHistory } from "@/lib/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? String(session.user.id) : null;
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getBalanceHistory(userId));
  } catch (error) {
    console.error("Get wallet balance history error:", error);
    return NextResponse.json({ error: "Không thể tải biến động số dư" }, { status: 500 });
  }
}
