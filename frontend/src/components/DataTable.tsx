import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

// Per-column UI hints (declaration merging on TanStack's ColumnMeta).
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    label?: string; // friendly name in the column-visibility menu
    filterVariant?: "text" | "number" | "select" | "none";
  }
}

const textFilter: FilterFn<unknown> = (row, columnId, value) => {
  const v = row.getValue(columnId);
  return String(v ?? "").toLowerCase().includes(String(value).toLowerCase());
};

const minFilter: FilterFn<unknown> = (row, columnId, value) => {
  const v = row.getValue(columnId);
  if (v === null || v === undefined || v === "") return false;
  return Number(v) >= Number(value);
};

const selectFilter: FilterFn<unknown> = (row, columnId, value) => {
  if (value === "" || value === undefined) return true;
  return String(row.getValue(columnId) ?? "") === String(value);
};

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  tableId: string;
  toolbar?: ReactNode; // optional left-aligned controls (e.g. RSI selector)
}

export function DataTable<T>({ columns, data, tableId, toolbar }: Props<T>) {
  const visKey = `dt:${tableId}:vis`;
  const filtKey = `dt:${tableId}:filt`;
  const sortKey = `dt:${tableId}:sort`;

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => loadState(visKey, {}),
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    () => loadState(filtKey, []),
  );
  const [sorting, setSorting] = useState<SortingState>(() => loadState(sortKey, []));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(visKey, JSON.stringify(columnVisibility)); }, [columnVisibility, visKey]);
  useEffect(() => { localStorage.setItem(filtKey, JSON.stringify(columnFilters)); }, [columnFilters, filtKey]);
  useEffect(() => { localStorage.setItem(sortKey, JSON.stringify(sorting)); }, [sorting, sortKey]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Inject filterFn based on each column's filterVariant.
  const preparedColumns = useMemo<ColumnDef<T, any>[]>(
    () =>
      columns.map((col) => {
        const variant = col.meta?.filterVariant ?? "text";
        if (variant === "none") return { ...col, enableColumnFilter: false };
        const filterFn =
          variant === "number" ? minFilter : variant === "select" ? selectFilter : textFilter;
        return { ...col, filterFn: filterFn as FilterFn<T> };
      }),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: preparedColumns,
    state: { columnVisibility, columnFilters, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const hasFilters = columnFilters.length > 0;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="row" style={{ gap: 8 }}>{toolbar}</div>
        <div className="row" style={{ gap: 8 }}>
          {hasFilters && (
            <button className="ghost" onClick={() => setColumnFilters([])}>Clear filters</button>
          )}
          <div className="col-menu-wrap" ref={menuRef}>
            <button className="ghost" onClick={() => setMenuOpen((o) => !o)}>Columns ▾</button>
            {menuOpen && (
              <div className="col-menu">
                {table.getAllLeafColumns().map((col) => (
                  <label key={col.id} className="col-menu-item">
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                    />
                    <span>{col.columnDef.meta?.label ?? col.id}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id}>
                    <div
                      className={header.column.getCanSort() ? "th-sortable" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
          {table.getHeaderGroups().map((hg) => (
            <tr key={`${hg.id}-filters`} className="filter-row">
              {hg.headers.map((header) => (
                <th key={header.id}>
                  {header.column.getCanFilter() ? (
                    <ColumnFilter column={header.column} />
                  ) : null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={table.getVisibleLeafColumns().length} className="muted">
                No rows match.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ColumnFilter<T>({ column }: { column: Column<T, unknown> }) {
  const variant = column.columnDef.meta?.filterVariant ?? "text";
  const value = (column.getFilterValue() ?? "") as string;
  const faceted = column.getFacetedUniqueValues();
  const options = useMemo(
    () =>
      variant === "select"
        ? Array.from(faceted.keys()).filter((v) => v !== "" && v != null).sort()
        : [],
    [faceted, variant],
  );

  if (variant === "select") {
    return (
      <select
        className="col-filter"
        value={value}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>{String(o)}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="col-filter"
      type={variant === "number" ? "number" : "text"}
      placeholder={variant === "number" ? "≥ min" : "filter…"}
      value={value}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
    />
  );
}
