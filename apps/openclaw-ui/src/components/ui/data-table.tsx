"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: keyof TData & string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const raw = row.getValue(columnId);
      return String(raw ?? "")
        .toLowerCase()
        .includes(String(filterValue ?? "").toLowerCase());
    },
  });

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {searchKey ? (
        <input
          value={globalFilter}
          onChange={(event) => {
            const value = event.target.value;
            setGlobalFilter(value);
            table.getColumn(searchKey)?.setFilterValue(value);
          }}
          placeholder="Ara..."
          className="input"
          style={{ maxWidth: "18rem" }}
        />
      ) : null}

      <div
        style={{
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          backgroundColor: "var(--card)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ borderBottom: "1px solid var(--border)" }}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      textAlign: "left",
                      padding: "0.75rem",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: "0.75rem", fontSize: "0.85rem" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    textAlign: "center",
                    padding: "1.5rem",
                    color: "var(--text-muted)",
                  }}
                >
                  Veri bulunamadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button
          className="btn-outline"
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Geri
        </button>
        <button
          className="btn-outline"
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Ileri
        </button>
      </div>
    </div>
  );
}

