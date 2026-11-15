import { asc } from "drizzle-orm";
import { UserManager } from "@/components/dashboard/user-manager";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export default async function UsersAdmin() {
  const s = await requireAdmin();
  const users = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, createdAt: user.createdAt })
    .from(user)
    .orderBy(asc(user.createdAt));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="text-sm text-muted">Editors can edit content and media. Admins can also delete content and manage users.</p>
      <UserManager users={users.map((u) => ({ ...u, role: u.role ?? "editor", banned: !!u.banned }))} me={s.user.id} />
    </div>
  );
}
