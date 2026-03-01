/**
 * Office 3D — Agent Configuration
 *
 * This file defines the visual layout of agents in the 3D office.
 * Names, emojis and roles are loaded at runtime from the OpenClaw API
 * (/api/agents → openclaw.json), so you only need to set positions and colors here.
 *
 * Agent IDs correspond to workspace directory suffixes:
 *   id: "main"     → workspace/          (main agent)
 *   id: "studio"   → workspace-studio/
 *   id: "infra"    → workspace-infra/
 *   etc.
 *
 * Add, remove or reposition agents to match your own OpenClaw setup.
 */

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number]; // x, y, z
  color: string;
  role: string;
}

export const AGENTS: AgentConfig[] = [
  {
    id: "main",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🦞",
    position: [0, 0, 0], // Center — main desk
    color: "#FFCC00",
    role: "Main Agent",
  },
  {
    id: "academic",
    name: "Academic",
    emoji: "🎓",
    position: [-4, 0, -3],
    color: "#4CAF50",
    role: "Knowledge Agent",
  },
  {
    id: "studio",
    name: "Studio",
    emoji: "🎬",
    position: [4, 0, -3],
    color: "#E91E63",
    role: "Media Agent",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    emoji: "💼",
    position: [-4, 0, 3],
    color: "#0077B5",
    role: "Brand Agent",
  },
  {
    id: "social",
    name: "Social",
    emoji: "📱",
    position: [4, 0, 3],
    color: "#ec4899",
    role: "Social Agent",
  },
  {
    id: "infra",
    name: "Infra",
    emoji: "🔧",
    position: [0, 0, 6],
    color: "#f97316",
    role: "DevOps Agent",
  },
  {
    id: "devclaw",
    name: "DevClaw",
    emoji: "👨‍💻",
    position: [0, 0, -6],
    color: "#8b5cf6",
    role: "Developer Agent",
  },
];

export type AgentStatus = "idle" | "working" | "thinking" | "error";

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string; // opus, sonnet, haiku
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number; // days
}
