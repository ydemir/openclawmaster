import { LogViewer } from "./log-viewer";

export default function LogsPage() {
  return (
    <div style={{ padding: "1.5rem 2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.7rem", fontWeight: 700 }}>Ağ Geçidi Logları</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Cross-platform SSE akisi (`gateway.log`).
        </p>
      </div>
      <LogViewer />
    </div>
  );
}


