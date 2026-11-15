import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: {
    enabled: true,
    // Staff accounts are created by admins from the dashboard (or `npm run create-admin`)
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: { expiresIn: 60 * 60 * 24 * 14, cookieCache: { enabled: true, maxAge: 300 } },
  plugins: [admin({ defaultRole: "editor", adminRoles: ["admin"] }), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type Role = "admin" | "editor";
