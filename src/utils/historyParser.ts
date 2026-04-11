import type { HistoryEntry, ProjectSummary } from "../types/history";

export const PROJECT_COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#8b5cf6", // violet
];

export function parseProjectName(projectPath: string): string {
  if (!projectPath) return projectPath;
  const parts = projectPath.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) return projectPath;
  const claudeIdx = parts.indexOf(".claude");
  if (claudeIdx > 0) return parts[claudeIdx - 1];
  return parts[parts.length - 1];
}

export function getProjectSummaries(entries: HistoryEntry[]): ProjectSummary[] {
  const byProject = new Map<
    string,
    { messages: number; sessions: Set<string>; dates: Set<string>; timestamps: number[] }
  >();

  for (const entry of entries) {
    const key = entry.project;
    if (!byProject.has(key)) {
      byProject.set(key, { messages: 0, sessions: new Set(), dates: new Set(), timestamps: [] });
    }
    const group = byProject.get(key)!;
    group.messages++;
    group.dates.add(new Date(entry.timestamp).toISOString().slice(0, 10));
    if (entry.sessionId) {
      group.sessions.add(entry.sessionId);
    } else {
      group.timestamps.push(entry.timestamp);
    }
  }

  return Array.from(byProject.entries())
    .map(([project, group]) => {
      // For entries without sessionId, estimate sessions by 30-min gaps
      let sessionCount = group.sessions.size;
      if (group.timestamps.length > 0) {
        const sorted = group.timestamps.sort((a, b) => a - b);
        let gapSessions = 1;
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i] - sorted[i - 1] > 30 * 60 * 1000) gapSessions++;
        }
        sessionCount += gapSessions;
      }

      return {
        project,
        projectName: parseProjectName(project),
        messageCount: group.messages,
        sessionCount,
        activeDays: group.dates.size,
      };
    })
    .sort((a, b) => b.messageCount - a.messageCount);
}

export function getProjectDailyActivity(
  entries: HistoryEntry[]
): Record<string, string | number>[] {
  const projectNames = [...new Set(entries.map((e) => parseProjectName(e.project)))];
  const byDate = new Map<string, Record<string, number>>();

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toISOString().slice(0, 10);
    const name = parseProjectName(entry.project);
    if (!byDate.has(date)) byDate.set(date, {});
    const counts = byDate.get(date)!;
    counts[name] = (counts[name] || 0) + 1;
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => {
      const row: Record<string, string | number> = { date };
      for (const name of projectNames) {
        row[name] = counts[name] || 0;
      }
      return row;
    });
}

export function getHourlyActivityByProject(
  entries: HistoryEntry[]
): Record<string, string | number>[] {
  const projectNames = [...new Set(entries.map((e) => parseProjectName(e.project)))];
  const byHour = new Map<number, Record<string, number>>();

  for (const entry of entries) {
    const hour = new Date(entry.timestamp).getHours();
    const name = parseProjectName(entry.project);
    if (!byHour.has(hour)) byHour.set(hour, {});
    const counts = byHour.get(hour)!;
    counts[name] = (counts[name] || 0) + 1;
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const counts = byHour.get(hour) || {};
    const row: Record<string, string | number> = { hour: `${hour}시` };
    for (const name of projectNames) {
      row[name] = counts[name] || 0;
    }
    return row;
  });
}

export function getProjectNames(entries: HistoryEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const name = parseProjectName(entry.project);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

export interface HeatmapCell {
  day: number;  // 0(Sun)~6(Sat)
  hour: number; // 0~23
  count: number;
}

export function getWeekdayHourlyHeatmap(entries: HistoryEntry[]): HeatmapCell[] {
  const grid = new Map<string, number>();

  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const key = `${d.getDay()}-${d.getHours()}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, count: grid.get(`${day}-${hour}`) || 0 });
    }
  }
  return cells;
}

export function filterHistoryByDateRange(
  entries: HistoryEntry[],
  days: number
): HistoryEntry[] {
  if (days === 0) return entries;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter((e) => e.timestamp >= cutoff);
}
