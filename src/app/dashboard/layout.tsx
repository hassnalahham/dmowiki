import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardNav } from "@/components/dashboard/nav";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" } };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <DashboardNav user={{ name: s.user.name, email: s.user.email, role: s.user.role ?? "editor" }} />
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
