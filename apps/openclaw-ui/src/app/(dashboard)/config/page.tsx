import { ConfigEditor } from "./config-editor";

export default function ConfigPage() {
  return (
    <div style={{ padding: "1.5rem 2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.7rem", fontWeight: 700 }}>Config Editor</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          WebSocket RPC ile `config.get` / `config.apply`.
        </p>
      </div>
      <ConfigEditor />
    </div>
  );
}

