import type {
  HarnessBadge,
  HarnessBreakdown,
  HarnessGrade,
  HarnessRawConfig,
  HarnessScore,
} from "@/shared/types/harness";

export const HARNESS_GRADE_COLORS: Record<HarnessGrade, string> = {
  S: "#a855f7",
  A: "#3b82f6",
  B: "#22c55e",
  C: "#f59e0b",
  D: "#ef4444",
};

export function getGrade(score: number): HarnessGrade {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function scoreClaudeMd(cfg: HarnessRawConfig): number {
  if (!cfg.claudeMd.exists) return 0;
  return cfg.claudeMd.lines >= 30 ? 25 : 15;
}

function scoreSettings(cfg: HarnessRawConfig): number {
  const s = cfg.settings;
  let score = 0;
  if (s.hasSettings || s.hasLocal) score += 10;
  if (s.hasHooks) score += 8;
  if (s.permissionCount > 0) score += 7;
  return score;
}

function categoryPoints(count: number): number {
  if (count >= 3) return 9;
  if (count >= 1) return 5;
  return 0;
}

function scoreExtensions(cfg: HarnessRawConfig): number {
  const total =
    categoryPoints(cfg.commands) + categoryPoints(cfg.agents) + categoryPoints(cfg.skills);
  return Math.min(25, total);
}

function scoreMcp(cfg: HarnessRawConfig): number {
  if (!cfg.mcp.exists) return 0;
  return cfg.mcp.serverCount >= 1 ? 25 : 15;
}

function buildBadges(cfg: HarnessRawConfig): HarnessBadge[] {
  return [
    {
      id: "claude-md",
      label: "CLAUDE.md",
      achieved: cfg.claudeMd.exists,
      detail: cfg.claudeMd.exists ? `${cfg.claudeMd.lines}줄` : undefined,
    },
    {
      id: "claude-md-long",
      label: "CLAUDE.md 30줄+",
      achieved: cfg.claudeMd.exists && cfg.claudeMd.lines >= 30,
    },
    {
      id: "settings",
      label: "settings.json",
      achieved: cfg.settings.hasSettings || cfg.settings.hasLocal,
      detail:
        cfg.settings.hasSettings && cfg.settings.hasLocal
          ? "공유+로컬"
          : cfg.settings.hasSettings
            ? "공유"
            : cfg.settings.hasLocal
              ? "로컬"
              : undefined,
    },
    {
      id: "hooks",
      label: "hooks",
      achieved: cfg.settings.hasHooks,
    },
    {
      id: "permissions",
      label: "permissions",
      achieved: cfg.settings.permissionCount > 0,
      detail: cfg.settings.permissionCount > 0 ? `${cfg.settings.permissionCount}개` : undefined,
    },
    {
      id: "commands",
      label: "commands",
      achieved: cfg.commands > 0,
      detail: cfg.commands > 0 ? `${cfg.commands}개` : undefined,
    },
    {
      id: "agents",
      label: "agents",
      achieved: cfg.agents > 0,
      detail: cfg.agents > 0 ? `${cfg.agents}개` : undefined,
    },
    {
      id: "skills",
      label: "skills",
      achieved: cfg.skills > 0,
      detail: cfg.skills > 0 ? `${cfg.skills}개` : undefined,
    },
    {
      id: "mcp-file",
      label: ".mcp.json",
      achieved: cfg.mcp.exists,
    },
    {
      id: "mcp-server",
      label: "MCP 서버",
      achieved: cfg.mcp.serverCount >= 1,
      detail: cfg.mcp.serverCount > 0 ? `서버 ${cfg.mcp.serverCount}개` : undefined,
    },
  ];
}

export function scoreHarness(cfg: HarnessRawConfig): HarnessScore {
  const breakdown: HarnessBreakdown = cfg.exists
    ? {
        claudeMd: scoreClaudeMd(cfg),
        settings: scoreSettings(cfg),
        extensions: scoreExtensions(cfg),
        mcp: scoreMcp(cfg),
      }
    : { claudeMd: 0, settings: 0, extensions: 0, mcp: 0 };

  const score = breakdown.claudeMd + breakdown.settings + breakdown.extensions + breakdown.mcp;

  return {
    ...cfg,
    score,
    grade: getGrade(score),
    breakdown,
    badges: buildBadges(cfg),
  };
}

export function scoreHarnessAll(configs: HarnessRawConfig[]): HarnessScore[] {
  return configs.map(scoreHarness).sort((a, b) => {
    if (a.exists !== b.exists) return a.exists ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.projectName.localeCompare(b.projectName);
  });
}
