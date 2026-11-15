"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { createStaffUser, removeStaffUser, setStaffRole, toggleBan, type ActionState } from "@/app/dashboard/actions";

type U = { id: string; name: string; email: string; role: string; banned: boolean; createdAt: Date };

export function UserManager({ users, me }: { users: U[]; me: string }) {
  const router = useRouter();
  const [state, action, creating] = useActionState<ActionState, FormData>(createStaffUser, undefined);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError("");
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {u.name} {u.id === me && <span className="text-xs text-muted">(you)</span>}
                  </div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={u.id === me || pending}
                    onChange={(e) => run(() => setStaffRole(u.id, e.target.value as "admin" | "editor"))}
                    className="input py-1"
                    aria-label={`Role for ${u.email}`}
                  >
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">{u.banned ? <span className="text-danger">Disabled</span> : <span className="text-ok">Active</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {u.id !== me && (
                    <>
                      <button className="btn-ghost text-xs" disabled={pending} onClick={() => run(() => toggleBan(u.id, u.banned))}>
                        {u.banned ? "Enable" : "Disable"}
                      </button>{" "}
                      <button
                        className="btn-ghost text-xs text-danger"
                        disabled={pending}
                        onClick={() => confirm(`Delete ${u.email}?`) && run(() => removeStaffUser(u.id))}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && (
          <p role="alert" className="p-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <form action={action} className="card h-fit space-y-3 p-4">
        <h2 className="font-semibold">Add staff member</h2>
        <label className="block">
          <span className="label">Name</span>
          <input name="name" required className="input" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required className="input" />
        </label>
        <label className="block">
          <span className="label">Temporary password</span>
          <input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
        </label>
        <label className="block">
          <span className="label">Role</span>
          <select name="role" defaultValue="editor" className="input">
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button className="btn-primary w-full" disabled={creating}>
          {creating ? "Creating…" : "Create user"}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-sm text-ok">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
