import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Use in dashboard pages/layouts and every server action. */
export async function requireStaff() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.banned) redirect("/login?error=banned");
  return s;
}

export async function requireAdmin() {
  const s = await requireStaff();
  if (s.user.role !== "admin") redirect("/dashboard?denied=1");
  return s;
}
