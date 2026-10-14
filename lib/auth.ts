import crypto from "crypto";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { findUserByUsername, hashPassword, isDeviceSessionActive, registerDeviceSession } from "@/lib/store";
import { hasPasswordDiacritics } from "@/lib/password-validation";

const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "dev-nextauth-secret-change-me";

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        deviceId: { label: "Device ID", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const password = String(credentials.password);
        if (hasPasswordDiacritics(password)) {
          return null;
        }

        const username = String(credentials.username).trim();
        const user = await findUserByUsername(username);

        if (!user || !user.passwordHash) {
          return null;
        }

        if (user.banned) {
          return null;
        }

        if (user.passwordHash !== hashPassword(password)) {
          return null;
        }

        const sessionId = crypto.randomUUID();
        const headers = request.headers ?? {};
        const forwardedFor = headers["x-forwarded-for"];
        const ipAddress = typeof forwardedFor === "string"
          ? forwardedFor.split(",")[0].trim()
          : headers["x-real-ip"] ?? null;
        const userAgent = headers["user-agent"] ?? null;
        await registerDeviceSession(
          user.id,
          sessionId,
          String(credentials.deviceId ?? "unknown"),
          ipAddress,
          userAgent,
        );

        return {
          id: user.id,
          name: user.username,
          username: user.username,
          role: user.role,
          sessionId,
        };
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user && "id" in user) {
        const authUser = user as typeof user & {
          id?: string;
          username?: string;
          name?: string | null;
          role?: "user" | "admin";
          sessionId?: string;
        };
        token.userId = authUser.id;
        token.username = authUser.username ?? authUser.name ?? "guest";
        token.role = authUser.role ?? "user";
        token.deviceSessionId = authUser.sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const userId = String(token.userId ?? "guest");
        const sessionId = typeof token.deviceSessionId === "string" ? token.deviceSessionId : null;
        let isActive = false;
        if (sessionId && userId !== "guest") {
          try {
            isActive = await isDeviceSessionActive(userId, sessionId);
          } catch (error) {
            console.error("Validate device session error:", error);
          }
        }
        const dynamicSession = session as typeof session & {
          user: { id?: string; username?: string; role?: "user" | "admin" };
          deviceSessionActive?: boolean;
        };
        dynamicSession.user.id = isActive ? userId : "guest";
        dynamicSession.user.username = String(token.username ?? "guest");
        dynamicSession.user.role = isActive && token.role === "admin" ? "admin" : "user";
        dynamicSession.deviceSessionActive = isActive;
      }
      return session;
    },
  },
};
