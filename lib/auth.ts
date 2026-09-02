import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { findUserByUsername, hashPassword } from "@/lib/store";

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
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = String(credentials.username).trim();
        const user = await findUserByUsername(username);

        if (!user || !user.passwordHash) {
          return null;
        }

        if (user.passwordHash !== hashPassword(String(credentials.password))) {
          return null;
        }

        return {
          id: user.id,
          name: user.username,
          username: user.username,
          role: user.role,
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
        };
        token.userId = authUser.id;
        token.username = authUser.username ?? authUser.name ?? "guest";
        token.role = authUser.role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const dynamicSession = session as typeof session & {
          user: { id?: string; username?: string; role?: "user" | "admin" };
        };
        dynamicSession.user.id = String(token.userId ?? "guest");
        dynamicSession.user.username = String(token.username ?? "guest");
        dynamicSession.user.role = token.role === "admin" ? "admin" : "user";
      }
      return session;
    },
  },
};
