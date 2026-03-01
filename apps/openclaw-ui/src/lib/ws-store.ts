"use client";

import { create } from "zustand";

type WsStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type WsStore = {
  status: WsStatus;
  ws: WebSocket | null;
  manualClose: boolean;
  reconnectDelay: number;
  pendingRequests: Map<string, PendingRequest>;
  connect: () => void;
  disconnect: () => void;
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
};

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useWsStore = create<WsStore>((set, get) => ({
  status: "disconnected",
  ws: null,
  manualClose: false,
  reconnectDelay: 1000,
  pendingRequests: new Map<string, PendingRequest>(),

  connect: () => {
    const current = get();
    if (current.status === "connected" || current.status === "connecting") return;

    const wsUrl = process.env.NEXT_PUBLIC_OPENCLAW_WS ?? "ws://127.0.0.1:18789";
    set({ status: current.status === "reconnecting" ? "reconnecting" : "connecting", manualClose: false });

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ status: "connected", ws, reconnectDelay: 1000 });
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string) as {
          id?: string;
          result?: unknown;
          error?: unknown;
        };
        if (!frame.id) return;

        const pending = get().pendingRequests.get(frame.id);
        if (!pending) return;

        get().pendingRequests.delete(frame.id);
        if (frame.error) pending.reject(frame.error);
        else pending.resolve(frame.result);
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      set({ ws: null });
      const state = get();
      if (state.manualClose) {
        set({ status: "disconnected" });
        return;
      }

      set({ status: "reconnecting" });
      const nextDelay = Math.min(state.reconnectDelay * 2, 30000);
      reconnectTimer = setTimeout(() => {
        set({ reconnectDelay: nextDelay });
        get().connect();
      }, state.reconnectDelay);
    };

    ws.onerror = () => {
      ws.close();
    };
  },

  disconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    set({ manualClose: true, status: "disconnected" });
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    set({ ws: null });
  },

  send: (method, params = {}) =>
    new Promise((resolve, reject) => {
      const { ws, status, pendingRequests } = get();
      if (status !== "connected" || !ws) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = crypto.randomUUID();
      pendingRequests.set(id, { resolve, reject });

      ws.send(
        JSON.stringify({
          id,
          method,
          params,
        }),
      );

      setTimeout(() => {
        if (get().pendingRequests.has(id)) {
          get().pendingRequests.delete(id);
          reject(new Error("RPC timeout"));
        }
      }, 30000);
    }),
}));

