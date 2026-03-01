"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";
import Editor from "@monaco-editor/react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { useRpc } from "@/hooks/use-rpc";

export function ConfigEditor() {
  const { rpc } = useRpc();
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = (await rpc("config.get")) as { text?: string };
      setValue(response?.text ?? "{}");
    } catch {
      toast.error("Config yuklenemedi");
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function handleSave() {
    setSaving(true);
    try {
      JSON.parse(value);
      await rpc("config.apply", { text: value });
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
