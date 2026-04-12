import { describe, expect, it } from "vitest";
import type { DailyActivity, DailyModelTokens, ModelUsage } from "@/shared/types/stats";
import {
  filterByDateRange,
  formatModelName,
  getContributionLevel,
  getDailyTokensArray,
  getModelBreakdown,
  getToolCallData,
  getTotalTokensForDate,
} from "@/shared/utils/statsParser";

const sampleDailyTokens: DailyModelTokens[] = [
  {
    date: "2026-02-03",
    tokensByModel: { "claude-sonnet-4-5-20250929": 270, "claude-opus-4-5-20251101": 709 },
  },
  {
    date: "2026-02-04",
    tokensByModel: { "claude-opus-4-5-20251101": 9205 },
  },
  {
    date: "2026-02-05",
    tokensByModel: { "claude-opus-4-5-20251101": 32404 },
  },
  {
    date: "2026-02-11",
    tokensByModel: {
      "claude-opus-4-1-20250805": 669,
      "claude-haiku-4-5-20251001": 4,
      "claude-opus-4-6": 26629,
    },
  },
];

describe("getTotalTokensForDate", () => {
  it("sums all model tokens for a given date", () => {
    expect(getTotalTokensForDate(sampleDailyTokens, "2026-02-03")).toBe(979);
  });

  it("returns 0 for a date with no data", () => {
    expect(getTotalTokensForDate(sampleDailyTokens, "2026-01-01")).toBe(0);
  });

  it("handles multiple models correctly", () => {
    expect(getTotalTokensForDate(sampleDailyTokens, "2026-02-11")).toBe(27302);
  });
});

describe("getContributionLevel", () => {
  it("returns 0 for zero tokens", () => {
    expect(getContributionLevel(0, 40000)).toBe(0);
  });

  it("returns 1 for low usage", () => {
    expect(getContributionLevel(5000, 40000)).toBe(1);
  });

  it("returns 2 for moderate usage", () => {
    expect(getContributionLevel(15000, 40000)).toBe(2);
  });

  it("returns 3 for high usage", () => {
    expect(getContributionLevel(25000, 40000)).toBe(3);
  });

  it("returns 4 for very high usage", () => {
    expect(getContributionLevel(35000, 40000)).toBe(4);
  });

  it("returns 0 when maxTokens is 0", () => {
    expect(getContributionLevel(100, 0)).toBe(0);
  });
});

describe("getDailyTokensArray", () => {
  it("converts DailyModelTokens[] to flat date-total pairs", () => {
    const result = getDailyTokensArray(sampleDailyTokens);
    expect(result).toEqual([
      { date: "2026-02-03", tokens: 979 },
      { date: "2026-02-04", tokens: 9205 },
      { date: "2026-02-05", tokens: 32404 },
      { date: "2026-02-11", tokens: 27302 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(getDailyTokensArray([])).toEqual([]);
  });
});

describe("filterByDateRange", () => {
  const data = [
    { date: "2026-02-01", tokens: 100 },
    { date: "2026-02-05", tokens: 200 },
    { date: "2026-02-10", tokens: 300 },
    { date: "2026-02-15", tokens: 400 },
    { date: "2026-02-20", tokens: 500 },
  ];

  it("filters to last 7 days from reference date", () => {
    const result = filterByDateRange(data, 7, "2026-02-20");
    expect(result).toEqual([
      { date: "2026-02-15", tokens: 400 },
      { date: "2026-02-20", tokens: 500 },
    ]);
  });

  it("returns all data when days is 0 (meaning 'all')", () => {
    const result = filterByDateRange(data, 0, "2026-02-20");
    expect(result).toEqual(data);
  });
});

describe("formatModelName", () => {
  it("formats opus model name", () => {
    expect(formatModelName("claude-opus-4-6")).toBe("Opus 4.6");
  });

  it("formats sonnet model name with date suffix", () => {
    expect(formatModelName("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
  });

  it("formats haiku model name with date suffix", () => {
    expect(formatModelName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("formats opus with date suffix", () => {
    expect(formatModelName("claude-opus-4-5-20251101")).toBe("Opus 4.5");
  });

  it("formats opus 4-1 with date suffix", () => {
    expect(formatModelName("claude-opus-4-1-20250805")).toBe("Opus 4.1");
  });

  it("returns raw name for unknown format", () => {
    expect(formatModelName("some-unknown-model")).toBe("some-unknown-model");
  });
});

describe("getModelBreakdown", () => {
  const modelUsage: Record<string, ModelUsage> = {
    "claude-opus-4-6": {
      inputTokens: 20000,
      outputTokens: 80000,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0,
      contextWindow: 0,
      maxOutputTokens: 0,
    },
    "claude-sonnet-4-5-20250929": {
      inputTokens: 100,
      outputTokens: 100,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0,
      contextWindow: 0,
      maxOutputTokens: 0,
    },
  };

  it("returns model breakdown with formatted names and totals", () => {
    const result = getModelBreakdown(modelUsage);
    expect(result).toEqual([
      { name: "Opus 4.6", tokens: 100000, percentage: 99.8 },
      { name: "Sonnet 4.5", tokens: 200, percentage: 0.2 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(getModelBreakdown({})).toEqual([]);
  });
});

describe("getToolCallData", () => {
  const dailyActivity: DailyActivity[] = [
    { date: "2026-03-10", messageCount: 100, sessionCount: 3, toolCallCount: 250 },
    { date: "2026-03-11", messageCount: 50, sessionCount: 2, toolCallCount: 100 },
    { date: "2026-03-12", messageCount: 0, sessionCount: 0, toolCallCount: 0 },
  ];

  it("calculates tool call ratio correctly", () => {
    const result = getToolCallData(dailyActivity);
    expect(result).toHaveLength(3);
    expect(result[0].ratio).toBe(2.5);
    expect(result[1].ratio).toBe(2);
  });

  it("handles zero messages without division error", () => {
    const result = getToolCallData(dailyActivity);
    expect(result[2].ratio).toBe(0);
  });

  it("preserves date and raw counts", () => {
    const result = getToolCallData(dailyActivity);
    expect(result[0]).toEqual({
      date: "2026-03-10",
      toolCalls: 250,
      messages: 100,
      ratio: 2.5,
    });
  });

  it("returns empty array for empty input", () => {
    expect(getToolCallData([])).toEqual([]);
  });
});
