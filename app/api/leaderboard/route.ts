import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getLeaderboard } from "@/lib/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ leaderboard: await getLeaderboard() });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return NextResponse.json({ error: "Không thể tải bảng xếp hạng" }, { status: 500 });
  }
}