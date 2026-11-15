"use client";
import { BarChart3, FileText, GitBranch, Image as ImageIcon, LogOut, PawPrint, Users, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

const ITEMS = [
  { href: "/dashboard", label: "Analytics", icon: BarChart3, exact: true },
  { href: "/dashboard/pages", label: "Pages", icon: FileText },
  { href: "/dashboard/digimon", label: "Digimon", icon: PawPrint },
  { href: "/dashboard/evolutions", label: "Evolutions", icon: GitBranch },
  { href: "/dashboard/media", label: "Media", icon: ImageIcon },
  { href: "/dashboard/users", label: "Users", icon: Users, admin: true },
];

export function DashboardNav({ user }: { user: { name: string; email: string; role: string } }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="border-b border-border bg-bg-soft md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-text no-underline">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-black text-black">D</span>
          Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted" title="View site" aria-label="View site">
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            type="button"
            className="text-muted hover:text-text md:hidden"
            title={`Sign out ${user.email}`}
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
        {ITEMS.filter((i) => !i.admin || user.role === "admin").map((i) => {
          const active = i.exact ? path === i.href : path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm no-underline ${
                active ? "bg-panel-2 text-text" : "text-muted hover:bg-panel hover:text-text"
              }`}
            >
              <i.icon className="h-4 w-4" /> {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-border p-4 text-sm md:absolute md:bottom-0 md:block md:w-60">
        <div className="truncate font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted">{user.email} · {user.role}</div>
        <button
          className="btn-ghost mt-3 w-full"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
