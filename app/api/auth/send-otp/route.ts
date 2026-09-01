import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Chức năng OTP đã bị tắt. Hãy dùng đăng ký username/password." },
    { status: 410 }
  );
}
