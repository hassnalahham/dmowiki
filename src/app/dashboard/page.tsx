import Link from "next/link";
import { connection } from "next/server";
import { ViewsChart } from "@/components/dashboard/views-chart";
import { getAnalytics } from "@/lib/analytics";

const RANGES = [7, 30, 90] as const;

function BarList({ rows, empty }: { rows: { label: React.ReactNode; value: number; key: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="relative overflow-hidden rounded-md px-2 py-1 text-sm" title={`${r.value.toLocaleString()}`}>
          <span className="absolute inset-y-0 left-0 rounded-md bg-[#3987e5]/20" style={{ width: `${(r.value / max) * 100}%` }} />
          <span className="relative flex justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="tabular-nums text-muted">{r.value.toLocaleString()}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function Overview({ searchParams }: PageProps<"/dashboard">) {
  await connection(); // analytics use the current time
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.range) as 7) ? Number(sp.range) : 30;
  const a = await getAnalytics(days);
  const denied = sp.denied === "1";

  return (
    <div className="space-y-6">
      {denied && <p className="rounded-lg border border-danger/50 bg-danger/10 p-3 text-sm">That section is for admins only.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex rounded-lg border border-border bg-panel p-0.5 text-sm" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard?range=${r}`}
              className={`rounded-md px-3 py-1 no-underline ${r === days ? "bg-panel-2 text-text" : "text-muted"}`}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Page views", a.totals.views],
          ["Unique visitors", a.totals.visitors],
          ["Searches", a.topSearches.reduce((n, s) => n + s.searches, 0)],
          ["Pages", a.contentByType.reduce((n, c) => n + c.n, 0)],
        ].map(([k, v]) => (
          <div key={k as string} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-muted">{k}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{(v as number).toLocaleString()}</div>
            <div className="text-xs text-muted">{k === "Pages" ? "all time" : `last ${days} days`}</div>
          </div>
        ))}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Traffic</h2>
        <ViewsChart data={a.series} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Top pages</h2>
          <BarList
            empty="No views yet."
            rows={a.topPages.map((p) => ({
              key: p.path,
              value: p.views,
              label: (
                <Link href={p.path} target="_blank">
                  {p.title ?? p.path}
                </Link>
              ),
            }))}
          />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Top searches</h2>
          <BarList
            empty="No searches yet."
            rows={a.topSearches.map((s) => ({ key: s.query, value: s.searches, label: `${s.query}${s.results === 0 ? " (no results)" : ""}` }))}
          />
          {a.zeroSearches.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-muted">Searches with no results — content gaps</h3>
              <p className="text-sm">{a.zeroSearches.map((s) => `${s.query} (${s.searches})`).join(", ")}</p>
            </>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Referrers</h2>
          <BarList empty="No external referrers yet." rows={a.referrers.map((r) => ({ key: r.referrer ?? "", value: r.views, label: r.referrer }))} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Devices &amp; countries</h2>
          <BarList empty="No data yet." rows={a.devices.map((d) => ({ key: d.device ?? "?", value: d.views, label: d.device ?? "unknown" }))} />
          {a.countries.length > 0 && (
            <div className="mt-4">
              <BarList empty="" rows={a.countries.map((c) => ({ key: c.country ?? "?", value: c.views, label: c.country }))} />
            </div>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Content</h2>
          <BarList empty="No content imported yet." rows={a.contentByType.map((c) => ({ key: c.type, value: c.n, label: c.type }))} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Recent edits</h2>
          {a.recentEdits.length ? (
            <ul className="divide-y divide-border text-sm">
              {a.recentEdits.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <Link href={`/dashboard/pages/${e.pageId}`} className="font-medium">
                      {e.title}
                    </Link>
                    <span className="block truncate text-xs text-muted">
                      {e.comment} · {e.user ?? "unknown"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{new Date(e.createdAt).toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No edits yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
