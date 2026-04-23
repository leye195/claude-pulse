import fs from "fs";
import path from "path";
import type { HarnessRawConfig } from "../src/shared/types/harness.js";

export function resolveProjectRoot(projectPath: string): string {
  if (!projectPath) return projectPath;
  const parts = projectPath.split(path.sep);
  const claudeIdx = parts.indexOf(".claude");
  if (claudeIdx > 0) {
    return parts.slice(0, claudeIdx).join(path.sep) || path.sep;
  }
  return projectPath;
}

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content) return 0;
    const trimmed = content.endsWith("\n") ? content.slice(0, -1) : content;
    return trimmed.length === 0 ? 0 : trimmed.split("\n").length;
  } catch {
    return 0;
  }
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function countMarkdownFiles(dir: string): number {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md")).length;
  } catch {
    return 0;
  }
}

function countSkills(dir: string): number {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        count++;
        continue;
      }
      if (entry.isDirectory()) {
        const skillMd = path.join(dir, entry.name, "SKILL.md");
        if (fs.existsSync(skillMd)) count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function findClaudeMd(root: string): { exists: boolean; lines: number } {
  const candidates = [path.join(root, "CLAUDE.md"), path.join(root, ".claude", "CLAUDE.md")];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { exists: true, lines: countLines(p) };
    }
  }
  return { exists: false, lines: 0 };
}

function readSettings(root: string): HarnessRawConfig["settings"] {
  const settingsPath = path.join(root, ".claude", "settings.json");
  const localPath = path.join(root, ".claude", "settings.local.json");

  const hasSettings = fs.existsSync(settingsPath);
  const hasLocal = fs.existsSync(localPath);

  const merged: Record<string, unknown> = {};
  if (hasSettings) Object.assign(merged, readJsonSafe(settingsPath) ?? {});
  if (hasLocal) Object.assign(merged, readJsonSafe(localPath) ?? {});

  const hooks = merged.hooks;
  const hasHooks =
    hooks !== undefined &&
    hooks !== null &&
    (Array.isArray(hooks) ? hooks.length > 0 : Object.keys(hooks as object).length > 0);

  const permissions = merged.permissions as
    | { allow?: unknown[]; deny?: unknown[]; ask?: unknown[] }
    | undefined;
  const permissionCount =
    (permissions?.allow?.length ?? 0) +
    (permissions?.deny?.length ?? 0) +
    (permissions?.ask?.length ?? 0);

  return {
    hasSettings,
    hasLocal,
    hasHooks,
    permissionCount,
  };
}

function readMcp(root: string): { exists: boolean; serverCount: number } {
  const mcpPath = path.join(root, ".mcp.json");
  if (!fs.existsSync(mcpPath)) return { exists: false, serverCount: 0 };
  const data = readJsonSafe(mcpPath);
  const servers = data?.mcpServers;
  const serverCount =
    servers && typeof servers === "object" && !Array.isArray(servers)
      ? Object.keys(servers as object).length
      : 0;
  return { exists: true, serverCount };
}

function parseProjectName(projectPath: string): string {
  if (!projectPath) return projectPath;
  const parts = projectPath.split(path.sep).filter(Boolean);
  if (parts.length === 0) return projectPath;
  const claudeIdx = parts.indexOf(".claude");
  if (claudeIdx > 0) return parts[claudeIdx - 1];
  return parts[parts.length - 1];
}

function readSingle(originalPath: string): HarnessRawConfig {
  const resolved = resolveProjectRoot(originalPath);
  const projectName = parseProjectName(resolved);

  let exists = false;
  try {
    exists = fs.statSync(resolved).isDirectory();
  } catch {
    exists = false;
  }

  if (!exists) {
    return {
      project: originalPath,
      resolvedPath: resolved,
      projectName,
      exists: false,
      claudeMd: { exists: false, lines: 0 },
      settings: {
        hasSettings: false,
        hasLocal: false,
        hasHooks: false,
        permissionCount: 0,
      },
      commands: 0,
      agents: 0,
      skills: 0,
      mcp: { exists: false, serverCount: 0 },
    };
  }

  const claudeDir = path.join(resolved, ".claude");
  return {
    project: originalPath,
    resolvedPath: resolved,
    projectName,
    exists: true,
    claudeMd: findClaudeMd(resolved),
    settings: readSettings(resolved),
    commands: countMarkdownFiles(path.join(claudeDir, "commands")),
    agents: countMarkdownFiles(path.join(claudeDir, "agents")),
    skills: countSkills(path.join(claudeDir, "skills")),
    mcp: readMcp(resolved),
  };
}

export function readHarnessConfigs(paths: string[]): HarnessRawConfig[] {
  const seen = new Set<string>();
  const configs: HarnessRawConfig[] = [];
  for (const p of paths) {
    if (!p) continue;
    const resolved = resolveProjectRoot(p);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    configs.push(readSingle(p));
  }
  return configs;
}
