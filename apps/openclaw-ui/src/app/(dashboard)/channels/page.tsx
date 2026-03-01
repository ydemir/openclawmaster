import { readChannelConfig } from "@/lib/openclaw-fs";

export const dynamic = "force-dynamic";

const channelEmoji: Record<string, string> = {
  whatsapp: "📱",
  telegram: "✈️",
  signal: "🔒",
  discord: "💬",
  slack: "🟪",
  imessage: "🍎",
};

export default function KanallarPage() {
  const channels = readChannelConfig();
  const entries = Object.entries(channels);

  return (
    <div style={{ padding: "1.5rem 2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.7rem", fontWeight: 700 }}>Kanallar</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          `openclaw.json` icinden kanal durumlari.
        </p>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "0.8rem",
            padding: "1rem",
            color: "var(--text-muted)",
          }}
        >
          Kanal verisi bulunamadi.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "0.8rem",
          }}
        >
          {entries.map(([name, config]) => {
            const enabled = Boolean(config.enabled);
            const accounts = config.accounts && typeof config.accounts === "object"
              ? Object.keys(config.accounts as Record<string, unknown>)
              : [];
            const groups = config.groups && typeof config.groups === "object"
              ? Object.keys(config.groups as Record<string, unknown>)
              : [];

            return (
              <article
                key={name}
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  borderRadius: "0.8rem",
                  padding: "0.9rem",
                  display: "grid",
                  gap: "0.45rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "1rem" }}>
                    {channelEmoji[name] ?? "📡"} {name}
                  </strong>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      border: "1px solid var(--border)",
                      borderRadius: "999px",
                      padding: "0.2rem 0.5rem",
                      color: enabled ? "var(--success)" : "var(--text-muted)",
                      backgroundColor: enabled ? "rgba(74,222,128,0.1)" : "var(--card-elevated)",
                    }}
                  >
                    {enabled ? "Aktif" : "Devre Dışı"}
                  </span>
                </div>

                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  DM Politikası: <code>{String(config.dmPolicy ?? "-")}</code>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Grup Politikası: <code>{String(config.groupPolicy ?? "-")}</code>
                </div>
                {accounts.length ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Hesaplar: {accounts.join(", ")}
                  </div>
                ) : null}
                {groups.length ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Gruplar: {groups.length}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}


