import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Chức năng OTP đã bị tắt. Hãy dùng đăng ký username/password." },
    { status: 403 },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Chức năng OTP đã bị tắt. Hãy dùng đăng ký username/password." },
    { status: 403 },
  );
}
