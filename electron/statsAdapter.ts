import fs from "fs";
import path from "path";
import {
  loadDailyUsageData,
  getClaudePaths,
  globUsageFiles,
} from "ccusage/data-loader";
import type {
  StatsData,
  DailyActivity,
  DailyModelTokens,
  ModelUsage,
  LongestSession,
} from "../src/shared/types/stats.js";

interface WalkResult {
  dailyMessageCounts: Map<string, number>;
  dailyToolCallCounts: Map<string, number>;
  dailySessionIds: Map<string, Set<string>>;
  hourCounts: Map<string, number>;
  sessionTimestamps: Map<string, { first: number; last: number; messageCount: number }>;
  allSessionIds: Set<string>;
  totalMessages: number;
  firstTimestamp: number | null;
}

interface JsonlEntry {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    content?: Array<{ type?: string }>;
  };
}

async function walkJsonlFiles(): Promise<WalkResult> {
  const result: WalkResult = {
    dailyMessageCounts: new Map(),
    dailyToolCallCounts: new Map(),
    dailySessionIds: new Map(),
    hourCounts: new Map(),
    sessionTimestamps: new Map(),
    allSessionIds: new Set(),
    totalMessages: 0,
    firstTimestamp: null,
  };

  const claudePaths = getClaudePaths();
  let files: Array<{ file: string }>;
  try {
    files = await globUsageFiles(claudePaths);
  } catch {
    return result;
  }

  for (const { file: filePath } of files) {
    let content: string;
    try {
      content = await fs.promises.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    const sessionId = path.basename(filePath, ".jsonl");

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;

      let entry: JsonlEntry;
      try {
        entry = JSON.parse(line) as JsonlEntry;
      } catch {
        continue;
      }

      if (entry.type !== "assistant" || !entry.timestamp) continue;

      const ts = new Date(entry.timestamp).getTime();
      if (Number.isNaN(ts)) continue;

      const date = entry.timestamp.slice(0, 10);
      const hour = new Date(entry.timestamp).getUTCHours().toString();
      const entrySessionId = entry.sessionId ?? sessionId;

      // Count assistant messages per day
      result.dailyMessageCounts.set(date, (result.dailyMessageCounts.get(date) ?? 0) + 1);
      result.totalMessages += 1;

      // Count tool_use blocks per day
      const toolUseCount = Array.isArray(entry.message?.content)
        ? entry.message.content.filter((c) => c.type === "tool_use").length
        : 0;
      if (toolUseCount > 0) {
        result.dailyToolCallCounts.set(
          date,
          (result.dailyToolCallCounts.get(date) ?? 0) + toolUseCount
        );
      }

      // Track distinct sessions per day
      if (!result.dailySessionIds.has(date)) {
        result.dailySessionIds.set(date, new Set());
      }
      result.dailySessionIds.get(date)!.add(entrySessionId);
      result.allSessionIds.add(entrySessionId);

      // Hour distribution
      result.hourCounts.set(hour, (result.hourCounts.get(hour) ?? 0) + 1);

      // Session timestamps for longestSession
      const existing = result.sessionTimestamps.get(entrySessionId);
      if (existing) {
        if (ts < existing.first) existing.first = ts;
        if (ts > existing.last) existing.last = ts;
        existing.messageCount += 1;
      } else {
        result.sessionTimestamps.set(entrySessionId, { first: ts, last: ts, messageCount: 1 });
      }

      // Track earliest timestamp
      if (result.firstTimestamp === null || ts < result.firstTimestamp) {
        result.firstTimestamp = ts;
      }
    }
  }

  return result;
}

function buildLongestSession(
  sessionTimestamps: Map<string, { first: number; last: number; messageCount: number }>
): LongestSession {
  let longest: LongestSession = {
    sessionId: "",
    duration: 0,
    messageCount: 0,
    timestamp: "",
  };

  for (const [sessionId, info] of sessionTimestamps) {
    const duration = info.last - info.first;
    if (duration > longest.duration) {
      longest = {
        sessionId,
        duration,
        messageCount: info.messageCount,
        timestamp: new Date(info.first).toISOString(),
      };
    }
  }

  return longest;
}

let cachedResult: StatsData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export async function loadStatsData(): Promise<StatsData | null> {
  const now = Date.now();
  if (cachedResult && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedResult;
  }

  try {
    const [dailyUsage, walkResult] = await Promise.all([
      loadDailyUsageData(),
      walkJsonlFiles(),
    ]);

    if (dailyUsage.length === 0 && walkResult.totalMessages === 0) {
      return null;
    }

    // Sort daily usage by date ascending
    dailyUsage.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Build dailyModelTokens from ccusage
    const dailyModelTokens: DailyModelTokens[] = dailyUsage.map((day) => {
      const tokensByModel: Record<string, number> = {};
      for (const mb of day.modelBreakdowns) {
        tokensByModel[mb.modelName] = mb.inputTokens + mb.outputTokens;
      }
      return { date: day.date, tokensByModel };
    });

    // Build aggregated modelUsage from ccusage
    const modelUsage: Record<string, ModelUsage> = {};
    for (const day of dailyUsage) {
      for (const mb of day.modelBreakdowns) {
        const existing = modelUsage[mb.modelName];
        if (existing) {
          existing.inputTokens += mb.inputTokens;
          existing.outputTokens += mb.outputTokens;
          existing.cacheCreationInputTokens += mb.cacheCreationTokens;
          existing.cacheReadInputTokens += mb.cacheReadTokens;
          existing.costUSD += mb.cost;
        } else {
          modelUsage[mb.modelName] = {
            inputTokens: mb.inputTokens,
            outputTokens: mb.outputTokens,
            cacheCreationInputTokens: mb.cacheCreationTokens,
            cacheReadInputTokens: mb.cacheReadTokens,
            costUSD: mb.cost,
            webSearchRequests: 0,
            contextWindow: 0,
            maxOutputTokens: 0,
          };
        }
      }
    }

    // Build dailyCosts and totalCost from ccusage
    const dailyCosts: Record<string, number> = {};
    let totalCost = 0;
    for (const day of dailyUsage) {
      dailyCosts[day.date] = day.totalCost;
      totalCost += day.totalCost;
    }

    // Build dailyActivity from walker
    const allDates = new Set<string>([
      ...walkResult.dailyMessageCounts.keys(),
      ...dailyUsage.map((d) => d.date),
    ]);
    const dailyActivity: DailyActivity[] = [...allDates]
      .sort()
      .map((date) => ({
        date,
        messageCount: walkResult.dailyMessageCounts.get(date) ?? 0,
        sessionCount: walkResult.dailySessionIds.get(date)?.size ?? 0,
        toolCallCount: walkResult.dailyToolCallCounts.get(date) ?? 0,
      }));

    // Build hourCounts
    const hourCounts: Record<string, number> = {};
    for (const [hour, count] of walkResult.hourCounts) {
      hourCounts[hour] = count;
    }

    const longestSession = buildLongestSession(walkResult.sessionTimestamps);

    const firstSessionDate = walkResult.firstTimestamp
      ? new Date(walkResult.firstTimestamp).toISOString().slice(0, 10)
      : dailyUsage.length > 0
        ? dailyUsage[0].date
        : new Date().toISOString().slice(0, 10);

    const statsData: StatsData = {
      version: 1,
      lastComputedDate: new Date().toISOString().slice(0, 10),
      dailyActivity,
      dailyModelTokens,
      modelUsage,
      totalSessions: walkResult.allSessionIds.size,
      totalMessages: walkResult.totalMessages,
      longestSession,
      firstSessionDate,
      hourCounts,
      totalSpeculationTimeSavedMs: 0,
      dailyCosts,
      totalCost,
    };

    cachedResult = statsData;
    cacheTimestamp = now;
    return statsData;
  } catch (error) {
    console.error("Failed to load stats data:", error);
    return null;
  }
}
