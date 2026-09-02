import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAppSettings, setCustomSuccessRate } from "@/lib/store";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user && "role" in session.user && session.user.role === "admin");
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await getAppSettings());
  } catch (error) {
    console.error("Get admin settings error:", error);
    return NextResponse.json({ error: "Không thể tải cấu hình" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = (await request.json()) as { newSuccessRate?: unknown };
    const value = body.newSuccessRate;
    const customRate = value === null || value === "" ? null : Number(value);
    if (customRate !== null && (!Number.isFinite(customRate) || customRate < 0 || customRate > 100)) {
      return NextResponse.json({ error: "Tỷ lệ phải nằm trong khoảng 0 đến 100" }, { status: 400 });
    }

    const settings = await setCustomSuccessRate(customRate);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Update admin settings error:", error);
    return NextResponse.json({ error: "Không thể cập nhật cấu hình" }, { status: 500 });
  }
}