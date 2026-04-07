import type { DailyActivity, DailyModelTokens, ModelUsage } from "../types/stats";

export interface ModelBreakdownEntry {
  name: string;
  tokens: number;
  percentage: number;
}

export interface DailyTokenEntry {
  date: string;
  tokens: number;
}

export function getTotalTokensForDate(
  dailyModelTokens: DailyModelTokens[],
  date: string
): number {
  const entry = dailyModelTokens.find((d) => d.date === date);
  if (!entry) return 0;
  return Object.values(entry.tokensByModel).reduce((sum, t) => sum + t, 0);
}

export function getContributionLevel(tokens: number, maxTokens: number): number {
  if (maxTokens === 0 || tokens === 0) return 0;
  const ratio = tokens / maxTokens;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function getDailyTokensArray(
  dailyModelTokens: DailyModelTokens[]
): DailyTokenEntry[] {
  return dailyModelTokens.map((entry) => ({
    date: entry.date,
    tokens: Object.values(entry.tokensByModel).reduce((sum, t) => sum + t, 0),
  }));
}

export function filterByDateRange(
  data: DailyTokenEntry[],
  days: number,
  referenceDate: string
): DailyTokenEntry[] {
  if (days === 0) return data;
  const ref = new Date(referenceDate);
  const cutoff = new Date(ref);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

export function formatModelName(modelId: string): string {
  const match = modelId.match(/^claude-(\w+)-(\d+)-(\d+)(?:-\d{8})?$/);
  if (!match) return modelId;
  const [, family, major, minor] = match;
  return `${family.charAt(0).toUpperCase() + family.slice(1)} ${major}.${minor}`;
}

export interface ToolCallEntry {
  date: string;
  toolCalls: number;
  messages: number;
  ratio: number;
}

export function getToolCallData(dailyActivity: DailyActivity[]): ToolCallEntry[] {
  return dailyActivity.map((d) => ({
    date: d.date,
    toolCalls: d.toolCallCount,
    messages: d.messageCount,
    ratio: d.messageCount > 0
      ? Math.round((d.toolCallCount / d.messageCount) * 100) / 100
      : 0,
  }));
}

export function getModelBreakdown(
  modelUsage: Record<string, ModelUsage>
): ModelBreakdownEntry[] {
  const entries = Object.entries(modelUsage).map(([modelId, usage]) => ({
    name: formatModelName(modelId),
    tokens: usage.inputTokens + usage.outputTokens,
  }));

  const total = entries.reduce((sum, e) => sum + e.tokens, 0);
  if (total === 0) return [];

  return entries
    .map((e) => ({
      ...e,
      percentage: Math.round((e.tokens / total) * 1000) / 10,
    }))
    .sort((a, b) => b.tokens - a.tokens);
}
