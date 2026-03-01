"use client";

import { useCallback } from "react";
import { useWsStore } from "@/lib/ws-store";

export function useRpc() {
  const send = useWsStore((state) => state.send);

  const rpc = useCallback(
    (method: string, params?: Record<string, unknown>) => send(method, params),
    [send],
  );

  return { rpc };
}

