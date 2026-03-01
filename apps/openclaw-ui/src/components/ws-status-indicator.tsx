"use client";

import { useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useWsStore } from "@/lib/ws-store";

export function WsStatusIndicator() {
  const status = useWsStore((state) => state.status);
  const connect = useWsStore((state) => state.connect);
  const disconnect = useWsStore((state) => state.disconnect);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const isConnected = status === "connected";
  const isPending = status === "connecting" || status === "reconnecting";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "0.2rem 0.5rem",
        borderRadius: "9999px",
        border: `1px solid ${isConnected ? "rgba(74,222,128,0.35)" : "var(--border)"}`,
        backgroundColor: isConnected ? "rgba(74,222,128,0.1)" : "var(--card-elevated)",
        color: isConnected ? "var(--success)" : "var(--text-muted)",
      }}
      title={`WebSocket: ${status}`}
    >
      {isConnected ? (
        <Wifi style={{ width: "12px", height: "12px" }} />
      ) : (
        <WifiOff style={{ width: "12px", height: "12px" }} />
      )}
      {isConnected ? "Bağlı" : isPending ? "Yeniden bağlanıyor" : "Bağlantı yok"}
    </div>
  );
}
