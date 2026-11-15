/**
 * Create (or promote) a dashboard admin.
 *   npm run create-admin -- --email you@example.com --password "secret123" --name "Admin"
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { arg } from "./import/lib";

async function main() {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name") ?? "Admin";
  if (!email || !password) throw new Error('Usage: npm run create-admin -- --email you@example.com --password "secret123"');
  const existing = await db.query.user.findFirst({ where: eq(user.email, email.toLowerCase()) });
  if (existing) {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id));
    console.log(`Promoted ${email} to admin`);
  } else {
    await auth.api.createUser({ body: { email, password, name, role: "admin" } });
    console.log(`Created admin ${email}`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
