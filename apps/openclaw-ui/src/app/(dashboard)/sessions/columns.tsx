"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import type { SessionRow } from "@/lib/openclaw-fs";

function toLocale(value: number) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR");
}

const channelColor: Record<string, string> = {
  whatsapp: "#4ade80",
  telegram: "#60a5fa",
  signal: "#a78bfa",
  discord: "#818cf8",
  cron: "#f59e0b",
};

export const columns: ColumnDef<SessionRow>[] = [
  {
    accessorKey: "label",
    header: "Session",
    cell: ({ row }) => (
      <Link
        href={`/sessions/${encodeURIComponent(row.original.sessionId)}`}
        style={{ fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "3px" }}
      >
        {row.original.label}
      </Link>
    ),
  },
  {
    accessorKey: "channel",
    header: "Kanal",
    cell: ({ row }) => (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.75rem",
          padding: "0.2rem 0.45rem",
          borderRadius: "999px",
          backgroundColor: "var(--card-elevated)",
          border: "1px solid var(--border)",
          color: channelColor[row.original.channel] ?? "var(--text-secondary)",
        }}
      >
        {row.original.channel}
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Son Aktivite",
    cell: ({ row }) => toLocale(row.original.updatedAt),
  },
  {
    accessorKey: "totalTokens",
    header: "Tokens",
    cell: ({ row }) => row.original.totalTokens.toLocaleString("tr-TR"),
  },
];

