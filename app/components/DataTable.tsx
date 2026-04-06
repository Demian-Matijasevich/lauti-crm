"use client";

import { useState, useMemo } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  searchKey?: keyof T;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  data, columns, searchKey, searchPlaceholder = "Buscar...", pageSize = 20, onRowClick,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let result = data;
    if (search && searchKey) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        String(row[searchKey] ?? "").toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, searchKey, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-3">
      {searchKey && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full max-w-sm px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-white text-sm focus:border-[var(--purple)] outline-none"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--card-bg)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  className={`px-3 py-2 text-left text-xs text-[var(--muted)] font-medium uppercase ${
                    col.sortable ? "cursor-pointer hover:text-white" : ""
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? " \u25B2" : " \u25BC")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-[var(--card-border)] ${
                  onRowClick ? "cursor-pointer hover:bg-white/5" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-[var(--foreground)]">
                    {col.render ? col.render(row) : String(row[col.key] ?? "\u2014")}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[var(--muted)]">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>{filtered.length} registros</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded bg-[var(--card-bg)] disabled:opacity-30"
            >
              {"\u2190"}
            </button>
            <span className="px-2 py-1">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded bg-[var(--card-bg)] disabled:opacity-30"
            >
              {"\u2192"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
