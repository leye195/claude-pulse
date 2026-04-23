import type { HarnessRawConfig } from "@/shared/types/harness";
import { getGrade, scoreHarness, scoreHarnessAll } from "@/shared/utils/harnessScorer";
import { describe, expect, it } from "vitest";

function makeRaw(overrides: Partial<HarnessRawConfig> = {}): HarnessRawConfig {
  return {
    project: "/home/user/p",
    resolvedPath: "/home/user/p",
    projectName: "p",
    exists: true,
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
    ...overrides,
  };
}

describe("scoreHarness", () => {
  it("returns 0 score and D grade when nothing is configured", () => {
    const result = scoreHarness(makeRaw());
    expect(result.score).toBe(0);
    expect(result.grade).toBe("D");
    expect(result.breakdown).toEqual({
      claudeMd: 0,
      settings: 0,
      extensions: 0,
      mcp: 0,
    });
  });

  it("returns full 100 score and S grade when everything is at maximum", () => {
    const result = scoreHarness(
      makeRaw({
        claudeMd: { exists: true, lines: 120 },
        settings: {
          hasSettings: true,
          hasLocal: true,
          hasHooks: true,
          permissionCount: 10,
        },
        commands: 5,
        agents: 3,
        skills: 3,
        mcp: { exists: true, serverCount: 2 },
      })
    );
    expect(result.score).toBe(100);
    expect(result.grade).toBe("S");
    expect(result.breakdown).toEqual({
      claudeMd: 25,
      settings: 25,
      extensions: 25,
      mcp: 25,
    });
  });

  it("awards 15 for CLAUDE.md existence without length bonus under 30 lines", () => {
    const result = scoreHarness(makeRaw({ claudeMd: { exists: true, lines: 29 } }));
    expect(result.breakdown.claudeMd).toBe(15);
  });

  it("awards full 25 for CLAUDE.md at exactly 30 lines", () => {
    const result = scoreHarness(makeRaw({ claudeMd: { exists: true, lines: 30 } }));
    expect(result.breakdown.claudeMd).toBe(25);
  });

  it("awards settings 10 when only local settings is present", () => {
    const result = scoreHarness(
      makeRaw({
        settings: {
          hasSettings: false,
          hasLocal: true,
          hasHooks: false,
          permissionCount: 0,
        },
      })
    );
    expect(result.breakdown.settings).toBe(10);
  });

  it("sums settings components: 10 file + 8 hooks + 7 permissions", () => {
    const result = scoreHarness(
      makeRaw({
        settings: {
          hasSettings: true,
          hasLocal: false,
          hasHooks: true,
          permissionCount: 1,
        },
      })
    );
    expect(result.breakdown.settings).toBe(25);
  });

  it("caps extensions score at 25 when each category has 3+ items", () => {
    const result = scoreHarness(makeRaw({ commands: 3, agents: 3, skills: 3 }));
    expect(result.breakdown.extensions).toBe(25);
  });

  it("awards 5 per category with 1-2 items", () => {
    const result = scoreHarness(makeRaw({ commands: 1, agents: 2, skills: 0 }));
    expect(result.breakdown.extensions).toBe(10);
  });

  it("awards mcp 15 for file only when serverCount is 0", () => {
    const result = scoreHarness(makeRaw({ mcp: { exists: true, serverCount: 0 } }));
    expect(result.breakdown.mcp).toBe(15);
  });

  it("awards mcp 25 when file exists and server count >= 1", () => {
    const result = scoreHarness(makeRaw({ mcp: { exists: true, serverCount: 1 } }));
    expect(result.breakdown.mcp).toBe(25);
  });

  it("marks non-existent projects with exists=false and D grade", () => {
    const result = scoreHarness(
      makeRaw({
        exists: false,
        claudeMd: { exists: false, lines: 0 },
      })
    );
    expect(result.exists).toBe(false);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("D");
  });

  it("produces 10 badges per result", () => {
    const result = scoreHarness(makeRaw());
    expect(result.badges).toHaveLength(10);
  });

  it("marks badges as achieved only when their criterion is met", () => {
    const result = scoreHarness(
      makeRaw({
        claudeMd: { exists: true, lines: 45 },
        commands: 2,
        mcp: { exists: true, serverCount: 0 },
      })
    );
    const byId = Object.fromEntries(result.badges.map((b) => [b.id, b]));
    expect(byId["claude-md"].achieved).toBe(true);
    expect(byId["claude-md-long"].achieved).toBe(true);
    expect(byId["commands"].achieved).toBe(true);
    expect(byId["agents"].achieved).toBe(false);
    expect(byId["mcp-file"].achieved).toBe(true);
    expect(byId["mcp-server"].achieved).toBe(false);
  });
});

describe("getGrade", () => {
  it("returns correct grade at boundary thresholds", () => {
    expect(getGrade(100)).toBe("S");
    expect(getGrade(90)).toBe("S");
    expect(getGrade(89)).toBe("A");
    expect(getGrade(75)).toBe("A");
    expect(getGrade(74)).toBe("B");
    expect(getGrade(60)).toBe("B");
    expect(getGrade(59)).toBe("C");
    expect(getGrade(40)).toBe("C");
    expect(getGrade(39)).toBe("D");
    expect(getGrade(0)).toBe("D");
  });
});

describe("scoreHarnessAll", () => {
  it("sorts existing projects by score descending and places non-existent at the end", () => {
    const result = scoreHarnessAll([
      makeRaw({ project: "low", projectName: "low" }),
      makeRaw({
        project: "high",
        projectName: "high",
        claudeMd: { exists: true, lines: 100 },
        settings: {
          hasSettings: true,
          hasLocal: false,
          hasHooks: true,
          permissionCount: 3,
        },
      }),
      makeRaw({ project: "gone", projectName: "gone", exists: false }),
      makeRaw({
        project: "mid",
        projectName: "mid",
        claudeMd: { exists: true, lines: 10 },
      }),
    ]);
    expect(result.map((r) => r.projectName)).toEqual(["high", "mid", "low", "gone"]);
  });
});
