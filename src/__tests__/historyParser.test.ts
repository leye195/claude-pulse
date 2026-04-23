import type { HistoryEntry } from "@/shared/types/history";
import {
  filterHistoryByDateRange,
  getHourlyActivityByProject,
  getProjectDailyActivity,
  getProjectNames,
  getProjectSummaries,
  getWeekdayHourlyHeatmap,
  parseProjectName,
} from "@/shared/utils/historyParser";
import { describe, expect, it } from "vitest";

const sampleEntries: HistoryEntry[] = [
  {
    display: "msg1",
    timestamp: new Date("2026-03-10T10:00:00").getTime(),
    project: "/home/user/projects/web",
  },
  {
    display: "msg2",
    timestamp: new Date("2026-03-10T10:05:00").getTime(),
    project: "/home/user/projects/web",
    sessionId: "s1",
  },
  {
    display: "msg3",
    timestamp: new Date("2026-03-10T14:00:00").getTime(),
    project: "/home/user/projects/web",
    sessionId: "s2",
  },
  {
    display: "msg4",
    timestamp: new Date("2026-03-11T11:00:00").getTime(),
    project: "/home/user/projects/admin",
    sessionId: "s3",
  },
  {
    display: "msg5",
    timestamp: new Date("2026-03-11T15:00:00").getTime(),
    project: "/home/user/projects/admin",
    sessionId: "s3",
  },
  {
    display: "msg6",
    timestamp: new Date("2026-03-12T09:00:00").getTime(),
    project: "/home/user/projects/web",
    sessionId: "s4",
  },
];

describe("parseProjectName", () => {
  it("extracts basename from path", () => {
    expect(parseProjectName("/home/user/projects/web")).toBe("web");
  });

  it("handles trailing slash", () => {
    expect(parseProjectName("/home/user/projects/web/")).toBe("web");
  });

  it("returns input for bare name", () => {
    expect(parseProjectName("web")).toBe("web");
  });

  it("handles Windows backslash path", () => {
    expect(parseProjectName("D:\\2025\\patrick\\seoul-moment-api")).toBe("seoul-moment-api");
  });

  it("extracts project name before .claude/worktrees", () => {
    expect(
      parseProjectName("D:\\2025\\seoul-moment-api\\.claude\\worktrees\\refactor+admin-article")
    ).toBe("seoul-moment-api");
  });

  it("extracts project name before .claude on POSIX path", () => {
    expect(parseProjectName("/Users/me/code/myapp/.claude/worktrees/feature")).toBe("myapp");
  });
});

describe("getProjectSummaries", () => {
  it("groups by project and sorts by message count", () => {
    const summaries = getProjectSummaries(sampleEntries);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].projectName).toBe("web");
    expect(summaries[0].messageCount).toBe(4);
    expect(summaries[1].projectName).toBe("admin");
    expect(summaries[1].messageCount).toBe(2);
  });

  it("counts active days correctly", () => {
    const summaries = getProjectSummaries(sampleEntries);
    const web = summaries.find((s) => s.projectName === "web")!;
    expect(web.activeDays).toBe(2); // 03-10, 03-12
  });

  it("counts sessions from sessionId", () => {
    const summaries = getProjectSummaries(sampleEntries);
    const admin = summaries.find((s) => s.projectName === "admin")!;
    expect(admin.sessionCount).toBe(1); // only s3
  });

  it("estimates sessions by gap for entries without sessionId", () => {
    const entries: HistoryEntry[] = [
      { display: "a", timestamp: 1000, project: "/p" },
      { display: "b", timestamp: 2000, project: "/p" },
      { display: "c", timestamp: 2000 + 31 * 60 * 1000, project: "/p" }, // 31 min gap
    ];
    const summaries = getProjectSummaries(entries);
    expect(summaries[0].sessionCount).toBe(2);
  });

  it("returns empty array for empty input", () => {
    expect(getProjectSummaries([])).toEqual([]);
  });
});

describe("getProjectDailyActivity", () => {
  it("returns daily counts per project", () => {
    const daily = getProjectDailyActivity(sampleEntries);
    expect(daily.length).toBeGreaterThanOrEqual(2);

    const march10 = daily.find((d) => d.date === "2026-03-10");
    expect(march10).toBeDefined();
    expect(march10!["web"]).toBe(3);
    expect(march10!["admin"]).toBe(0);
  });

  it("fills missing projects with 0", () => {
    const daily = getProjectDailyActivity(sampleEntries);
    const march11 = daily.find((d) => d.date === "2026-03-11");
    expect(march11!["web"]).toBe(0);
    expect(march11!["admin"]).toBe(2);
  });

  it("is sorted by date ascending", () => {
    const daily = getProjectDailyActivity(sampleEntries);
    for (let i = 1; i < daily.length; i++) {
      expect(daily[i].date > daily[i - 1].date).toBe(true);
    }
  });
});

describe("getHourlyActivityByProject", () => {
  it("returns 24 hours", () => {
    const hourly = getHourlyActivityByProject(sampleEntries);
    expect(hourly).toHaveLength(24);
  });

  it("counts messages at correct hours", () => {
    const hourly = getHourlyActivityByProject(sampleEntries);
    const hour10 = hourly.find((h) => h.hour === "10시");
    expect(hour10!["web"]).toBe(2); // 10:00 and 10:05
  });

  it("has zero for inactive hours", () => {
    const hourly = getHourlyActivityByProject(sampleEntries);
    const hour0 = hourly.find((h) => h.hour === "0시");
    expect(hour0!["web"]).toBe(0);
    expect(hour0!["admin"]).toBe(0);
  });
});

describe("getProjectNames", () => {
  it("returns names sorted by frequency", () => {
    const names = getProjectNames(sampleEntries);
    expect(names).toEqual(["web", "admin"]);
  });
});

describe("getWeekdayHourlyHeatmap", () => {
  it("returns 168 cells (7 days × 24 hours)", () => {
    const cells = getWeekdayHourlyHeatmap(sampleEntries);
    expect(cells).toHaveLength(168);
  });

  it("counts correctly for specific day/hour", () => {
    const cells = getWeekdayHourlyHeatmap(sampleEntries);
    // 2026-03-10 is Tuesday (day=2), hours 10 and 14
    const tue10 = cells.find((c) => c.day === 2 && c.hour === 10);
    expect(tue10!.count).toBe(2); // msg1 + msg2 at 10:00 and 10:05
    const tue14 = cells.find((c) => c.day === 2 && c.hour === 14);
    expect(tue14!.count).toBe(1); // msg3 at 14:00
  });

  it("has zero for inactive slots", () => {
    const cells = getWeekdayHourlyHeatmap(sampleEntries);
    const sun0 = cells.find((c) => c.day === 0 && c.hour === 0);
    expect(sun0!.count).toBe(0);
  });

  it("returns empty counts for empty input", () => {
    const cells = getWeekdayHourlyHeatmap([]);
    expect(cells).toHaveLength(168);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });
});

describe("filterHistoryByDateRange", () => {
  it("returns all entries when days is 0", () => {
    expect(filterHistoryByDateRange(sampleEntries, 0)).toEqual(sampleEntries);
  });

  it("filters by recent days", () => {
    const now = Date.now();
    const entries: HistoryEntry[] = [
      { display: "old", timestamp: now - 10 * 24 * 60 * 60 * 1000, project: "/p" },
      { display: "recent", timestamp: now - 1000, project: "/p" },
    ];
    const result = filterHistoryByDateRange(entries, 7);
    expect(result).toHaveLength(1);
    expect(result[0].display).toBe("recent");
  });
});
