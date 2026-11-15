import Link from "next/link";
import { Suspense } from "react";
import { PageViewTracker } from "@/components/page-view-tracker";
import { SearchBox } from "@/components/search-box";

const NAV = [
  { href: "/digimon", label: "Digimon" },
  { href: "/browse/item", label: "Items" },
  { href: "/browse/map", label: "Maps" },
  { href: "/browse/quest", label: "Quests" },
  { href: "/browse/patch", label: "Patches" },
  { href: "/categories", label: "Categories" },
];

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-text no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-black text-black">D</span>
            DMO&nbsp;Wiki
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm md:order-2 md:w-auto">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted no-underline hover:bg-panel hover:text-text">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 ml-auto w-full max-w-xs md:order-3">
            <Suspense fallback={<div className="input h-9" />}>
              <SearchBox />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Content imported from{" "}
        <a href="https://dmowiki.com" target="_blank" rel="noopener nofollow">
          dmowiki.com
        </a>{" "}
        for private use. Digimon and Digimon Masters Online are trademarks of their respective owners.
      </footer>
      <Suspense>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
