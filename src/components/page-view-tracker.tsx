"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Sends one beacon per client-side navigation to /api/track (no cookies). */
export function PageViewTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    const body = JSON.stringify({ path: pathname, referrer: document.referrer || null });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  }, [pathname]);
  return null;
}
