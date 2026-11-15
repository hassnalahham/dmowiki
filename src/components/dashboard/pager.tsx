import Link from "next/link";

export function Pager({
  base,
  page,
  total,
  perPage,
  params,
}: {
  base: string;
  page: number;
  total: number;
  perPage: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${q}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-muted">
      <span>
        {total.toLocaleString()} total · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn-ghost no-underline">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="btn-ghost no-underline">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
