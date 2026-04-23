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

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    if (!content) return 0;
    const trimmed = content.endsWith("\n") ? content.slice(0, -1) : content;
    return trimmed.length === 0 ? 0 : trimmed.split("\n").length;
  } catch {
    return 0;
  }
}

async function readJsonSafe(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function countMarkdownFiles(dir: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md")).length;
  } catch {
    return 0;
  }
}

async function countSkills(dir: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const counts = await Promise.all(
      entries.map(async (entry): Promise<number> => {
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) return 1;
        if (entry.isDirectory()) {
          const skillMd = path.join(dir, entry.name, "SKILL.md");
          return (await fileExists(skillMd)) ? 1 : 0;
        }
        return 0;
      })
    );
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function findClaudeMd(root: string): Promise<{ exists: boolean; lines: number }> {
  const candidates = [path.join(root, "CLAUDE.md"), path.join(root, ".claude", "CLAUDE.md")];
  const checks = await Promise.all(
    candidates.map(async (p) => ({ path: p, exists: await fileExists(p) }))
  );
  const first = checks.find((c) => c.exists);
  if (!first) return { exists: false, lines: 0 };
  return { exists: true, lines: await countLines(first.path) };
}

async function readSettings(root: string): Promise<HarnessRawConfig["settings"]> {
  const settingsPath = path.join(root, ".claude", "settings.json");
  const localPath = path.join(root, ".claude", "settings.local.json");

  const [hasSettings, hasLocal, settingsJson, localJson] = await Promise.all([
    fileExists(settingsPath),
    fileExists(localPath),
    readJsonSafe(settingsPath),
    readJsonSafe(localPath),
  ]);

  const merged: Record<string, unknown> = {};
  if (settingsJson) Object.assign(merged, settingsJson);
  if (localJson) Object.assign(merged, localJson);

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

async function readMcp(root: string): Promise<{ exists: boolean; serverCount: number }> {
  const mcpPath = path.join(root, ".mcp.json");
  const [exists, data] = await Promise.all([fileExists(mcpPath), readJsonSafe(mcpPath)]);
  if (!exists) return { exists: false, serverCount: 0 };
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

async function readSingle(originalPath: string): Promise<HarnessRawConfig> {
  const resolved = resolveProjectRoot(originalPath);
  const projectName = parseProjectName(resolved);

  let exists = false;
  try {
    const st = await fs.promises.stat(resolved);
    exists = st.isDirectory();
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
  const [claudeMd, settings, commands, agents, skills, mcp] = await Promise.all([
    findClaudeMd(resolved),
    readSettings(resolved),
    countMarkdownFiles(path.join(claudeDir, "commands")),
    countMarkdownFiles(path.join(claudeDir, "agents")),
    countSkills(path.join(claudeDir, "skills")),
    readMcp(resolved),
  ]);

  return {
    project: originalPath,
    resolvedPath: resolved,
    projectName,
    exists: true,
    claudeMd,
    settings,
    commands,
    agents,
    skills,
    mcp,
  };
}

export async function readHarnessConfigs(paths: string[]): Promise<HarnessRawConfig[]> {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    const resolved = resolveProjectRoot(p);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    unique.push(p);
  }
  return Promise.all(unique.map(readSingle));
}
