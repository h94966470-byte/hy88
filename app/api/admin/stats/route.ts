import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getGameStats } from "@/lib/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("role" in session.user) || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json({ stats: await getGameStats() });
  } catch (error) {
    console.error("Get admin stats error:", error);
    return NextResponse.json({ error: "Không thể tải thống kê ván" }, { status: 500 });
  }
}