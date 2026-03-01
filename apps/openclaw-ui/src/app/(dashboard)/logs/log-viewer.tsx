"use client";

import { useEffect, useRef, useState } from "react";

export function LogViewer() {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/logs/stream");
    es.onopen = () => setStatus("open");
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { line?: string };
        const line = payload.line;
        if (typeof line !== "string") return;
        setLines((prev) => [...prev.slice(-800), line]);
      } catch {
        // ignore malformed frames
      }
    };
    es.onerror = () => {
      setStatus("closed");
      es.close();
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.45rem",
          fontSize: "0.78rem",
          color: status === "open" ? "var(--success)" : status === "connecting" ? "var(--warning)" : "var(--error)",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: "currentColor",
          }}
        />
        {status === "open" ? "LIVE" : status === "connecting" ? "CONNECTING" : "CLOSED"}
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "0.8rem",
          backgroundColor: "#0d1117",
          color: "#9ad89a",
          fontFamily: "var(--font-mono)",
          fontSize: "0.78rem",
          lineHeight: 1.5,
          padding: "0.8rem",
          minHeight: "68vh",
          maxHeight: "68vh",
          overflow: "auto",
        }}
      >
        {lines.length ? (
          lines.map((line, index) => <div key={`${index}-${line.slice(0, 12)}`}>{line}</div>)
        ) : (
          <div style={{ color: "#8b949e" }}>Log bekleniyor...</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
