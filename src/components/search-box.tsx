"use client";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { wikiHref } from "@/lib/slug";

type Suggestion = { title: string; slug: string; type: string; stage: string | null; alias?: string; icon: string | null };

/** Bold the part of the title that matches the query. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-accent">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const listId = useId();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<Record<string, Suggestion[]>>({});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = q.trim().toLowerCase();
  const items = results[term] ?? [];
  const loading = !!term && !(term in results);

  // debounced fetch; results are memoised per term so going back to a previous query is instant
  useEffect(() => {
    if (!term || term in results) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: Suggestion[] };
        setResults((r) => ({ ...r, [term]: data.items }));
      } catch {
        /* aborted or offline */
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, results]);

  // close when clicking outside
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    router.push(href);
  };
  const searchAll = () => q.trim() && go(`/search?q=${encodeURIComponent(q.trim())}`);

  const showList = open && q.trim().length > 0;
  // the last row is always "Search for …"
  const rowCount = items.length + 1;

  return (
    <form
      ref={boxRef}
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && active < items.length) go(wikiHref(items[active].slug));
        else searchAll();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % rowCount);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? rowCount - 1 : a - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        placeholder="Search the wiki…"
        className="input h-9 pl-9"
        aria-label="Search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow-2xl shadow-black/50"
        >
          {items.map((s, i) => (
            <li
              key={s.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => {
                e.preventDefault(); // keep focus; navigate on click
                go(wikiHref(s.slug));
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${active === i ? "bg-panel-2" : ""}`}
            >
              {s.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.icon} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-contain" />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-bg-soft text-muted">
                  <FileText className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text">
                  <Highlight text={s.title} query={q.trim()} />
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {s.alias ? `from “${s.alias}”` : [s.type === "digimon" ? "Digimon" : s.type, s.stage].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
          {!items.length && !loading && <li className="px-3 py-2 text-sm text-muted">No pages match “{q.trim()}”.</li>}
          <li
            id={`${listId}-${items.length}`}
            role="option"
            aria-selected={active === items.length}
            onPointerEnter={() => setActive(items.length)}
            onPointerDown={(e) => {
              e.preventDefault();
              searchAll();
            }}
            className={`mt-1 flex cursor-pointer items-center gap-2 rounded-lg border-t border-border px-2 py-2 text-sm text-muted ${
              active === items.length ? "bg-panel-2 text-text" : ""
            }`}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">
              Search all pages for “<span className="text-text">{q.trim()}</span>”
            </span>
            <CornerDownLeft className="h-3.5 w-3.5" />
          </li>
        </ul>
      )}
    </form>
  );
}
