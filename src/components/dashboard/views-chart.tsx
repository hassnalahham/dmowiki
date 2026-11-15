"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated categorical pair for the dark panel surface (#152038): blue = views, orange = visitors
const SERIES = [
  { key: "views", label: "Page views", color: "#3987e5" },
  { key: "visitors", label: "Unique visitors", color: "#d95926" },
] as const;

type Point = { day: string; views: number; visitors: number };

export function ViewsChart({ data }: { data: Point[] }) {
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const last = data.at(-1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm" aria-label="Legend">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2 text-muted">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
            {last && <b className="tabular-nums text-text">{last[s.key].toLocaleString()} today</b>}
          </span>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#26365a" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="day" tickFormatter={fmt} tick={{ fill: "#93a3c1", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fill: "#93a3c1", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "#93a3c1", strokeWidth: 1 }}
              contentStyle={{ background: "#1b2945", border: "1px solid #26365a", borderRadius: 8, color: "#e6ecf7", fontSize: 12 }}
              labelFormatter={(d) => fmt(String(d))}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={s.color}
                fillOpacity={s.key === "views" ? 0.15 : 0}
                dot={false}
                activeDot={{ r: 4, stroke: "#152038", strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1">Day</th>
              <th>Views</th>
              <th>Visitors</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="py-1">{d.day}</td>
                <td className="tabular-nums">{d.views}</td>
                <td className="tabular-nums">{d.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
