"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";
import Editor from "@monaco-editor/react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

export function ConfigEditor() {
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        throw new Error("Config okunamadi");
      }
      const response = (await res.json()) as { text?: string };
      setValue(response?.text ?? "{}");
    } catch {
      toast.error("Config yuklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function handleSave() {
    setSaving(true);
    try {
      JSON.parse(value);
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok) {
        throw new Error("Config kaydi basarisiz");
      }
      toast.success("Config kaydedildi ve uygulandi");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      toast.error(`Kayit basarisiz: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn-outline" onClick={() => void loadConfig()} disabled={loading}>
          <RefreshCw style={{ width: "14px", height: "14px" }} />
          Yenile
        </button>
        <button className="btn-primary" onClick={() => void handleSave()} disabled={saving || loading}>
          <Save style={{ width: "14px", height: "14px" }} />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: "0.8rem", overflow: "hidden" }}>
        <Editor
          height="calc(100vh - 14rem)"
          language="json"
          value={value}
          onChange={(next) => setValue(next ?? "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
