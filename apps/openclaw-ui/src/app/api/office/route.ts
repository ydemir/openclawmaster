import { NextResponse } from "next/server";
import { readFileSync, statSync, readdirSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const AGENT_CONFIG = {
  main: { emoji: "🦞", color: "#ff6b35", name: "Tenacitas", role: "Boss" },
  academic: {
    emoji: "🎓",
    color: "#4ade80",
    name: "Profe",
    role: "Teacher",
  },
  infra: {
    emoji: "🔧",
    color: "#f97316",
    name: "Infra",
    role: "DevOps",
  },
  studio: {
    emoji: "🎬",
    color: "#a855f7",
    name: "Studio",
    role: "Video Editor",
  },
  social: {
    emoji: "📱",
    color: "#ec4899",
    name: "Social",
    role: "Social Media",
  },
  linkedin: {
    emoji: "💼",
    color: "#0077b5",
    name: "LinkedIn Pro",
    role: "Professional",
  },
  devclaw: {
    emoji: "👨‍💻",
    color: "#8b5cf6",
    name: "DevClaw",
    role: "Developer",
  },
  freelance: {
    emoji: "👨‍💻",
    color: "#8b5cf6",
    name: "DevClaw",
    role: "Developer",
  },
};

interface AgentSession {
  agentId: string;
  sessionId: string;
  label?: string;
  lastActivity?: string;
  createdAt?: string;
}

interface AgentDefinition {
  id: string;
  name?: string;
  workspace: string;
}

type AgentStatus = {
  isActive: boolean;
  currentTask: string;
  lastSeen: number;
};

function normalizeWorkspacePath(workspace: string, openclawDir: string): string {
  if (!workspace) return workspace;
  if (workspace.startsWith("/")) return workspace;
  return join(openclawDir, workspace);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function guessWorkspacePath(
  agentId: string,
  openclawDir: string,
  defaultWorkspace: string
): string {
  const candidates: string[] = [];

  if (agentId === "main") {
    candidates.push(join(openclawDir, "workspace"));
  } else {
    candidates.push(join(openclawDir, `workspace-${agentId}`));
  }

  if (defaultWorkspace) {
    candidates.push(defaultWorkspace);
  }

  // Last fallback for unknown agents
  candidates.push(join(openclawDir, "workspace"));

  return candidates.find((candidate) => isDirectory(candidate)) || candidates[0];
}

function discoverAgents(config: any, openclawDir: string): AgentDefinition[] {
  const discovered: AgentDefinition[] = [];
  const seen = new Set<string>();

  const addAgent = (agent: AgentDefinition) => {
    if (!agent.id || !agent.workspace || seen.has(agent.id)) return;
    seen.add(agent.id);
    discovered.push(agent);
  };

  const defaultWorkspace =
    typeof config?.agents?.defaults?.workspace === "string" &&
    config.agents.defaults.workspace.length > 0
      ? normalizeWorkspacePath(config.agents.defaults.workspace, openclawDir)
      : "";

  const configuredList = Array.isArray(config?.agents?.list)
    ? (config.agents.list as unknown[])
    : [];

  for (const rawAgent of configuredList) {
    let id = "";
    let name: string | undefined;
    let workspace = "";

    if (typeof rawAgent === "string") {
      id = rawAgent;
    } else if (rawAgent && typeof rawAgent === "object") {
      const agent = rawAgent as Record<string, unknown>;
      if (typeof agent.id === "string") id = agent.id;
      if (typeof agent.name === "string") name = agent.name;
      if (typeof agent.workspace === "string" && agent.workspace.length > 0) {
        workspace = normalizeWorkspacePath(agent.workspace, openclawDir);
      }
    }

    if (!id) continue;
    if (!workspace) {
      workspace = guessWorkspacePath(id, openclawDir, defaultWorkspace);
    }

    addAgent({ id, name, workspace });
  }

  if (discovered.length > 0) {
    return discovered;
  }

  if (defaultWorkspace) {
    addAgent({ id: "main", name: "Main", workspace: defaultWorkspace });
  }

  try {
    const dirs = readdirSync(openclawDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("workspace-"))
      .map((entry) => entry.name);

    for (const dirName of dirs) {
      const rawId = dirName.replace(/^workspace-/, "");
      const agentId = rawId || "main";
      const workspacePath = join(openclawDir, dirName);
      addAgent({
        id: agentId,
        name: agentId,
        workspace: workspacePath,
      });
    }
  } catch {
    // If discovery fails (permission/path issues), keep whatever we already found.
  }

  // Secondary fallback for setups that keep agent folders under openclawDir/agents.
  try {
    const agentDirs = readdirSync(join(openclawDir, "agents"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const agentId of agentDirs) {
      addAgent({
        id: agentId,
        name: agentId,
        workspace: guessWorkspacePath(agentId, openclawDir, defaultWorkspace),
      });
    }
  } catch {
    // Ignore if agents directory does not exist.
  }

  return discovered;
}

async function getAgentStatusFromGateway(): Promise<
  Record<string, AgentStatus>
> {
  try {
    const configPath = (process.env.OPENCLAW_DIR || "/root/.openclaw") + "/openclaw.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const gatewayToken = config.gateway?.auth?.token;

    if (!gatewayToken) {
      console.warn("No gateway token found");
      return {};
    }

    // Try to fetch sessions from gateway
    const response = await fetch("http://localhost:18789/api/sessions", {
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
      },
      signal: AbortSignal.timeout(2000), // 2s timeout
    });

    if (!response.ok) {
      console.warn("Gateway returned non-OK status:", response.status);
      return {};
    }

    // Verify Content-Type before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("Gateway returned non-JSON response:", contentType);
      return {};
    }

    const sessions = (await response.json()) as AgentSession[];
    const agentStatus: Record<string, AgentStatus> = {};

    for (const session of sessions) {
      if (!session.agentId) continue;

      const lastActivity = session.lastActivity
        ? new Date(session.lastActivity).getTime()
        : 0;
      const now = Date.now();
      const minutesAgo = (now - lastActivity) / 1000 / 60;

      let status = "SLEEPING";
      let currentTask = "zzZ...";

      if (minutesAgo < 5) {
        status = "ACTIVE";
        currentTask = session.label || "Working on task...";
      } else if (minutesAgo < 30) {
        status = "IDLE";
        currentTask = session.label || "Idle...";
      }

      // Keep most recent activity per agent
      if (
        !agentStatus[session.agentId] ||
        lastActivity > agentStatus[session.agentId].lastSeen
      ) {
        agentStatus[session.agentId] = {
          isActive: status === "ACTIVE",
          currentTask: `${status}: ${currentTask}`,
          lastSeen: lastActivity,
        };
      }
    }

    return agentStatus;
  } catch (error) {
    console.warn("Failed to fetch from gateway:", error);
    return {};
  }
}

function getAgentStatusFromSessionIndex(
  openclawDir: string,
  agentId: string
): AgentStatus | null {
  try {
    const sessionsIndexPath = join(
      openclawDir,
      "agents",
      agentId,
      "sessions",
      "sessions.json"
    );
    const raw = JSON.parse(readFileSync(sessionsIndexPath, "utf-8")) as Record<
      string,
      { updatedAt?: number; subject?: string; displayName?: string }
    >;

    if (!raw || typeof raw !== "object") return null;

    let latestTs = 0;
    let latestLabel = "";

    for (const entry of Object.values(raw)) {
      if (!entry || typeof entry !== "object") continue;
      const ts = typeof entry.updatedAt === "number" ? entry.updatedAt : 0;
      if (ts > latestTs) {
        latestTs = ts;
        latestLabel = entry.subject || entry.displayName || "";
      }
    }

    if (latestTs <= 0) return null;

    const now = Date.now();
    const minutesAgo = (now - latestTs) / 1000 / 60;
    const context = latestLabel ? ` (${latestLabel})` : "";

    if (minutesAgo < 5) {
      return {
        isActive: true,
        currentTask: `ACTIVE: Oturum aktif${context}`,
        lastSeen: latestTs,
      };
    }

    if (minutesAgo < 30) {
      return {
        isActive: false,
        currentTask: `IDLE: Son etkileşim${context}`,
        lastSeen: latestTs,
      };
    }

    return {
      isActive: false,
      currentTask: "SLEEPING: zzZ...",
      lastSeen: latestTs,
    };
  } catch {
    return null;
  }
}

function getAgentStatusFromFiles(
  agentId: string,
  workspace: string
): AgentStatus {
  try {
    const today = new Date().toISOString().split("T")[0];
    const memoryFile = join(workspace, "memory", `${today}.md`);

    // Check if file exists
    const stat = statSync(memoryFile);
    const lastSeen = stat.mtime.getTime();
    const minutesSinceUpdate = (Date.now() - lastSeen) / 1000 / 60;

    const content = readFileSync(memoryFile, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim());

    let currentTask = "Idle...";
    if (lines.length > 0) {
      // Get last meaningful line (skip timestamps)
      const lastLine = lines
        .slice(-10)
        .reverse()
        .find((l) => l.length > 20 && !l.match(/^#+\s/));

      if (lastLine) {
        currentTask = lastLine.replace(/^[-*]\s*/, "").slice(0, 100);
        if (lastLine.length > 100) currentTask += "...";
      }
    }

    // Determine status based on file modification time
    if (minutesSinceUpdate < 5) {
      return { isActive: true, currentTask: `ACTIVE: ${currentTask}`, lastSeen };
    } else if (minutesSinceUpdate < 30) {
      return { isActive: false, currentTask: `IDLE: ${currentTask}`, lastSeen };
    } else {
      return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen };
    }
  } catch {
    // No memory file or error reading
    return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen: 0 };
  }
}

export async function GET() {
  try {
    const openclawDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
    const configPath = join(openclawDir, "openclaw.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const agentDefinitions = discoverAgents(config, openclawDir);

    if (agentDefinitions.length === 0) {
      return NextResponse.json({ agents: [] });
    }

    // Try gateway first, fallback to file-based
    const gatewayStatus = await getAgentStatusFromGateway();

    const agents = agentDefinitions.map((agent) => {
      const agentInfo = AGENT_CONFIG[agent.id as keyof typeof AGENT_CONFIG] || {
        emoji: "🤖",
        color: "#666",
        name: agent.name || agent.id,
        role: "Agent",
      };

      // Get status from gateway, or fallback to files
      let status: AgentStatus | undefined = gatewayStatus[agent.id];
      if (!status) {
        const indexedStatus = getAgentStatusFromSessionIndex(openclawDir, agent.id);
        if (indexedStatus) status = indexedStatus;
      }
      if (!status) {
        status = getAgentStatusFromFiles(agent.id, agent.workspace);
      }

      // Map freelance -> devclaw for canvas compatibility
      const canvasId = agent.id === "freelance" ? "devclaw" : agent.id;

      return {
        id: canvasId,
        name: agentInfo.name,
        emoji: agentInfo.emoji,
        color: agentInfo.color,
        role: agentInfo.role,
        currentTask: status.currentTask,
        isActive: status.isActive,
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error getting office data:", error);
    return NextResponse.json({
      agents: [
        {
          id: "main",
          name: "Tenacitas",
          emoji: "🦞",
          color: "#ff6b35",
          role: "Boss",
          currentTask: "SLEEPING: zzZ...",
          isActive: false,
        },
      ],
      warning:
        "OpenClaw config could not be loaded. Using fallback office data.",
    });
  }
}
