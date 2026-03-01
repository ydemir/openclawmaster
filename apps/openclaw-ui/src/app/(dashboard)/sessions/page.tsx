import { readSessions } from "@/lib/openclaw-fs";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";

export default function SessionsPage() {
  const sessions = readSessions();

  return (
    <div style={{ padding: "1.5rem 2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.7rem",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Oturumlar
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          OpenClaw session listesi (`sessions.json`) uzerinden yuklenir.
        </p>
      </div>

      <DataTable columns={columns} data={sessions} searchKey="label" />
    </div>
  );
}



