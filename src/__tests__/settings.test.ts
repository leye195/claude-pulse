import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from "../types/settings";

describe("DEFAULT_SETTINGS", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_SETTINGS.notifications.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.completionAlert).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.stuckAlert).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.stuckThresholdMinutes).toBe(10);
    expect(DEFAULT_SETTINGS.notifications.stuckRepeatMinutes).toBe(30);
    expect(DEFAULT_SETTINGS.notifications.sound).toBe(true);
  });
});

describe("mergeSettings", () => {
  it("returns defaults when partial is empty", () => {
    expect(mergeSettings({}, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("overrides only specified fields", () => {
    const merged = mergeSettings(
      { notifications: { stuckThresholdMinutes: 5 } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckThresholdMinutes).toBe(5);
    expect(merged.notifications.enabled).toBe(true);
    expect(merged.notifications.stuckRepeatMinutes).toBe(30);
  });

  it("ignores unknown top-level keys", () => {
    const merged = mergeSettings(
      { notifications: {}, unknown: "x" } as Partial<AppSettings>,
      DEFAULT_SETTINGS
    );
    expect((merged as Record<string, unknown>).unknown).toBeUndefined();
  });

  it("clamps stuckThresholdMinutes to >= 1", () => {
    const merged = mergeSettings(
      { notifications: { stuckThresholdMinutes: 0 } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckThresholdMinutes).toBe(1);
  });

  it("clamps stuckRepeatMinutes to >= 1", () => {
    const merged = mergeSettings(
      { notifications: { stuckRepeatMinutes: -10 } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckRepeatMinutes).toBe(1);
  });
});
