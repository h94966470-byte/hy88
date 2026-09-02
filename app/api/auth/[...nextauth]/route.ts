import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

export async function POST(req: NextRequest) {
	if (req.nextUrl.pathname.endsWith("/callback/credentials")) {
		const rateLimit = await checkRateLimit(req, "3/minute");
		if (!rateLimit.success) {
			return rateLimitResponse(rateLimit.retryAfter, "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.");
		}
	}

	return handler(req);
}
