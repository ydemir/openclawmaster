import fs from "node:fs";
import path from "node:path";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR ?? "/root/.openclaw";

type SessionIndexEntry = {
  sessionId?: string;
  updatedAt?: number;
  totalTokens?: number;
  lastChannel?: string;
  origin?: {
    label?: string;
  };
};

export type SessionRow = {
  key: string;
  sessionId: string;
  label: string;
  channel: string;
  updatedAt: number;
  totalTokens: number;
};

export function getOpenClawPath(...segments: string[]) {
  return path.join(OPENCLAW_DIR, ...segments);
}

export function readJsonFile<T>(relativePath: string): T | null {
  try {
    const fullPath = getOpenClawPath(relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function readSessionsIndex() {
  return readJsonFile<Record<string, SessionIndexEntry>>("agents/main/sessions/sessions.json") ?? {};
}

export function readSessions(): SessionRow[] {
  const index = readSessionsIndex();
  return Object.entries(index)
    .map(([key, value]) => ({
      key,
      sessionId: value.sessionId ?? "",
      label: value.origin?.label ?? key,
      channel: value.lastChannel ?? key.split(":")[2] ?? "unknown",
      updatedAt: value.updatedAt ?? 0,
      totalTokens: value.totalTokens ?? 0,
    }))
    .filter((row) => Boolean(row.sessionId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function resolveSessionKeyFromSessionId(sessionId: string): string | null {
  const index = readSessionsIndex();
  for (const [key, value] of Object.entries(index)) {
    if (value.sessionId === sessionId) return key;
  }
  return null;
}

export function readCronJobs() {
  const data = readJsonFile<{ jobs?: Array<Record<string, unknown>> }>("cron/jobs.json");
  return data?.jobs ?? [];
}

export function readChannelConfig() {
  const data = readJsonFile<{ channels?: Record<string, Record<string, unknown>> }>("openclaw.json");
  return data?.channels ?? {};
}

