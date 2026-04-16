import fs from "fs";
import path from "path";
import readline from "readline";
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

interface TokenInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

interface WalkResult {
  dailyMessageCounts: Map<string, number>;
  dailyToolCallCounts: Map<string, number>;
  dailySessionIds: Map<string, Set<string>>;
  hourCounts: Map<string, number>;
  sessionTimestamps: Map<string, { first: number; last: number; messageCount: number }>;
  allSessionIds: Set<string>;
  totalMessages: number;
  firstTimestamp: number | null;
  // Token aggregation (replaces ccusage's token loading)
  dailyModelTokens: Map<string, Map<string, TokenInfo>>;
  modelUsage: Map<string, TokenInfo>;
}

interface JsonlEntry {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    content?: Array<{ type?: string }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: string;
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
    dailyModelTokens: new Map(),
    modelUsage: new Map(),
  };

  const claudePaths = getClaudePaths();
  let files: Array<{ file: string }>;
  try {
    files = await globUsageFiles(claudePaths);
  } catch {
    return result;
  }

  for (const { file: filePath } of files) {
    let stream: fs.ReadStream;
    try {
      stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    } catch {
      continue;
    }

    const sessionId = path.basename(filePath, ".jsonl");
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
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
      const existingSession = result.sessionTimestamps.get(entrySessionId);
      if (existingSession) {
        if (ts < existingSession.first) existingSession.first = ts;
        if (ts > existingSession.last) existingSession.last = ts;
        existingSession.messageCount += 1;
      } else {
        result.sessionTimestamps.set(entrySessionId, { first: ts, last: ts, messageCount: 1 });
      }

      // Track earliest timestamp
      if (result.firstTimestamp === null || ts < result.firstTimestamp) {
        result.firstTimestamp = ts;
      }

      // Token aggregation from usage data
      const usage = entry.message?.usage;
      const model = entry.message?.model;
      if (usage && model) {
        const tokens: TokenInfo = {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        };

        // Daily model tokens
        if (!result.dailyModelTokens.has(date)) {
          result.dailyModelTokens.set(date, new Map());
        }
        const dayModels = result.dailyModelTokens.get(date)!;
        const existingDay = dayModels.get(model);
        if (existingDay) {
          existingDay.inputTokens += tokens.inputTokens;
          existingDay.outputTokens += tokens.outputTokens;
          existingDay.cacheReadInputTokens += tokens.cacheReadInputTokens;
          existingDay.cacheCreationInputTokens += tokens.cacheCreationInputTokens;
        } else {
          dayModels.set(model, { ...tokens });
        }

        // Aggregated model usage
        const existingModel = result.modelUsage.get(model);
        if (existingModel) {
          existingModel.inputTokens += tokens.inputTokens;
          existingModel.outputTokens += tokens.outputTokens;
          existingModel.cacheReadInputTokens += tokens.cacheReadInputTokens;
          existingModel.cacheCreationInputTokens += tokens.cacheCreationInputTokens;
        } else {
          result.modelUsage.set(model, { ...tokens });
        }
      }
      }
    } catch {
      continue;
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
    // loadDailyUsageData: cost data only (requires ccusage's PricingFetcher)
    // walkJsonlFiles: tokens + activity data (single file pass)
    const [dailyUsage, walkResult] = await Promise.all([
      loadDailyUsageData(),
      walkJsonlFiles(),
    ]);

    if (dailyUsage.length === 0 && walkResult.totalMessages === 0) {
      return null;
    }

    // Build dailyModelTokens from walker
    const allDates = new Set<string>([
      ...walkResult.dailyMessageCounts.keys(),
      ...walkResult.dailyModelTokens.keys(),
    ]);
    const dailyModelTokens: DailyModelTokens[] = [...allDates].sort().map((date) => {
      const tokensByModel: Record<string, number> = {};
      const dayModels = walkResult.dailyModelTokens.get(date);
      if (dayModels) {
        for (const [model, info] of dayModels) {
          tokensByModel[model] = info.inputTokens + info.outputTokens;
        }
      }
      return { date, tokensByModel };
    });

    // Build aggregated modelUsage from walker tokens + ccusage costs
    const costByModel: Record<string, number> = {};
    for (const day of dailyUsage) {
      for (const mb of day.modelBreakdowns) {
        costByModel[mb.modelName] = (costByModel[mb.modelName] ?? 0) + mb.cost;
      }
    }

    const modelUsage: Record<string, ModelUsage> = {};
    for (const [model, tokens] of walkResult.modelUsage) {
      modelUsage[model] = {
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        cacheCreationInputTokens: tokens.cacheCreationInputTokens,
        cacheReadInputTokens: tokens.cacheReadInputTokens,
        costUSD: costByModel[model] ?? 0,
        webSearchRequests: 0,
        contextWindow: 0,
        maxOutputTokens: 0,
      };
    }

    // Build dailyCosts and totalCost from ccusage (cost calculation only)
    const dailyCosts: Record<string, number> = {};
    let totalCost = 0;
    for (const day of dailyUsage) {
      dailyCosts[day.date] = day.totalCost;
      totalCost += day.totalCost;
    }

    // Build dailyActivity from walker
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
