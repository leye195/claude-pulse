import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";
import {
  evaluate,
  type SessionInput,
  type SessionTrackState,
} from "../utils/sessionAlertLogic";

const settings: AppSettings = DEFAULT_SETTINGS;
const T0 = 1_700_000_000_000;

function session(id: string, isActive: boolean, projectName = "demo"): SessionInput {
  return { sessionId: id, isActive, projectName };
}

function activeState(id: string, since: number): SessionTrackState {
  return {
    sessionId: id,
    lastStatus: "active",
    activeSince: since,
    lastStuckAlertAt: null,
    hasFiredCompletionAlert: false,
  };
}

describe("evaluate — registration", () => {
  it("registers a new active session and starts activeSince", () => {
    const result = evaluate(new Map(), [session("s1", true)], settings, T0);
    expect(result.alerts).toEqual([]);
    expect(result.newState.get("s1")).toMatchObject({
      sessionId: "s1",
      lastStatus: "active",
      activeSince: T0,
      lastStuckAlertAt: null,
      hasFiredCompletionAlert: false,
    });
  });

  it("registers a new idle session with hasFiredCompletionAlert=true (suppress false-positive)", () => {
    const result = evaluate(new Map(), [session("s1", false)], settings, T0);
    expect(result.alerts).toEqual([]);
    expect(result.newState.get("s1")).toMatchObject({
      lastStatus: "idle",
      activeSince: null,
      hasFiredCompletionAlert: true,
    });
  });

  it("removes sessions that disappeared", () => {
    const prev = new Map<string, SessionTrackState>([
      [
        "s1",
        {
          sessionId: "s1",
          lastStatus: "active",
          activeSince: T0,
          lastStuckAlertAt: null,
          hasFiredCompletionAlert: false,
        },
      ],
    ]);
    const result = evaluate(prev, [], settings, T0 + 1000);
    expect(result.newState.has("s1")).toBe(false);
    expect(result.alerts).toEqual([]);
  });
});

describe("evaluate — completion alert (⚡→💤)", () => {
  it("fires completion alert when active session becomes idle", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const result = evaluate(prev, [session("s1", false)], settings, T0 + 5000);
    expect(result.alerts).toEqual([
      { type: "completion", sessionId: "s1", projectName: "demo" },
    ]);
    expect(result.newState.get("s1")).toMatchObject({
      lastStatus: "idle",
      activeSince: null,
      hasFiredCompletionAlert: true,
    });
  });

  it("does not fire completion alert twice in same idle cycle", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const r1 = evaluate(prev, [session("s1", false)], settings, T0 + 5000);
    const r2 = evaluate(r1.newState, [session("s1", false)], settings, T0 + 10000);
    expect(r2.alerts).toEqual([]);
  });

  it("re-arms completion alert after 💤→⚡→💤 cycle", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const r1 = evaluate(prev, [session("s1", false)], settings, T0 + 5000);
    const r2 = evaluate(r1.newState, [session("s1", true)], settings, T0 + 10000);
    const r3 = evaluate(r2.newState, [session("s1", false)], settings, T0 + 15000);
    expect(r3.alerts).toEqual([
      { type: "completion", sessionId: "s1", projectName: "demo" },
    ]);
  });

  it("does not fire completion alert when completionAlert setting is off", () => {
    const off: AppSettings = {
      notifications: { ...settings.notifications, completionAlert: false },
    };
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const result = evaluate(prev, [session("s1", false)], off, T0 + 5000);
    expect(result.alerts).toEqual([]);
  });
});

describe("evaluate — stuck alert", () => {
  it("fires stuck alert when active duration exceeds threshold", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const result = evaluate(prev, [session("s1", true)], settings, eleven);
    expect(result.alerts).toEqual([
      { type: "stuck", sessionId: "s1", projectName: "demo", activeMinutes: 11 },
    ]);
    expect(result.newState.get("s1")?.lastStuckAlertAt).toBe(eleven);
  });

  it("does not refire stuck alert before repeat interval", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const r1 = evaluate(prev, [session("s1", true)], settings, eleven);
    const fifteen = T0 + 15 * 60_000;
    const r2 = evaluate(r1.newState, [session("s1", true)], settings, fifteen);
    expect(r2.alerts).toEqual([]);
  });

  it("refires stuck alert after repeat interval elapsed", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const r1 = evaluate(prev, [session("s1", true)], settings, eleven);
    const fortyTwo = T0 + 42 * 60_000;
    const r2 = evaluate(r1.newState, [session("s1", true)], settings, fortyTwo);
    expect(r2.alerts).toEqual([
      { type: "stuck", sessionId: "s1", projectName: "demo", activeMinutes: 42 },
    ]);
  });

  it("does not fire stuck alert when stuckAlert setting is off", () => {
    const off: AppSettings = {
      notifications: { ...settings.notifications, stuckAlert: false },
    };
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const result = evaluate(prev, [session("s1", true)], off, eleven);
    expect(result.alerts).toEqual([]);
  });

  it("respects custom stuckThresholdMinutes from settings", () => {
    const custom: AppSettings = {
      notifications: { ...settings.notifications, stuckThresholdMinutes: 1 },
    };
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const result = evaluate(prev, [session("s1", true)], custom, T0 + 90_000);
    expect(result.alerts).toHaveLength(1);
  });
});

describe("evaluate — multi-session", () => {
  it("handles independent transitions for multiple sessions in the same tick", () => {
    const prev = new Map<string, SessionTrackState>([
      ["s1", activeState("s1", T0)], // about to complete
      ["s2", activeState("s2", T0)], // will go stuck
      [
        "s3",
        {
          sessionId: "s3",
          lastStatus: "idle",
          activeSince: null,
          lastStuckAlertAt: null,
          hasFiredCompletionAlert: true,
        },
      ], // idle, no transition
    ]);
    const eleven = T0 + 11 * 60_000;
    const result = evaluate(
      prev,
      [
        session("s1", false, "alpha"),
        session("s2", true, "beta"),
        session("s3", false, "gamma"),
      ],
      settings,
      eleven
    );

    expect(result.alerts).toHaveLength(2);
    expect(result.alerts).toContainEqual({
      type: "completion",
      sessionId: "s1",
      projectName: "alpha",
    });
    expect(result.alerts).toContainEqual({
      type: "stuck",
      sessionId: "s2",
      projectName: "beta",
      activeMinutes: 11,
    });
    expect(result.newState.get("s1")?.lastStatus).toBe("idle");
    expect(result.newState.get("s2")?.lastStuckAlertAt).toBe(eleven);
    expect(result.newState.get("s3")?.lastStatus).toBe("idle");
  });
});
