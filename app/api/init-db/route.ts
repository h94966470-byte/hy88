import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/initdb";

export async function POST(req: NextRequest) {
  try {
    // Verify this is only called locally or from Vercel
    const token = req.headers.get("x-init-token");
    const expectedToken = process.env.INIT_TOKEN;

    if (expectedToken && token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initializeDatabase();
    return NextResponse.json({ ok: true, message: "Database initialized successfully" });
  } catch (error) {
    console.error("Database initialization error:", error);
    return NextResponse.json(
      { error: "Database initialization failed", details: String(error) },
      { status: 500 }
    );
  }
}
