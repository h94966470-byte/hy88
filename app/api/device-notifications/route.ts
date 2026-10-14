import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDeviceLoginNotifications } from "@/lib/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? String(session.user.id) : null;
  if (!userId || userId === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDeviceLoginNotifications(userId));
  } catch (error) {
    console.error("Get device notifications error:", error);
    return NextResponse.json({ error: "Không thể tải thông báo thiết bị" }, { status: 500 });
  }
}
