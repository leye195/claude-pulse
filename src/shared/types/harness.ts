export interface HarnessRawConfig {
  project: string;
  resolvedPath: string;
  projectName: string;
  exists: boolean;
  claudeMd: { exists: boolean; lines: number };
  settings: {
    hasSettings: boolean;
    hasLocal: boolean;
    hasHooks: boolean;
    permissionCount: number;
  };
  commands: number;
  agents: number;
  skills: number;
  mcp: { exists: boolean; serverCount: number };
}

export type HarnessGrade = "S" | "A" | "B" | "C" | "D";

export type HarnessBadgeId =
  | "claude-md"
  | "claude-md-long"
  | "settings"
  | "hooks"
  | "permissions"
  | "commands"
  | "agents"
  | "skills"
  | "mcp-file"
  | "mcp-server";

export interface HarnessBadge {
  id: HarnessBadgeId;
  label: string;
  achieved: boolean;
  detail?: string;
}

export interface HarnessBreakdown {
  claudeMd: number;
  settings: number;
  extensions: number;
  mcp: number;
}

export interface HarnessScore extends HarnessRawConfig {
  score: number;
  grade: HarnessGrade;
  breakdown: HarnessBreakdown;
  badges: HarnessBadge[];
}
