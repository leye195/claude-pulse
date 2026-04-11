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

  it("falls back to base when stuckThresholdMinutes is NaN", () => {
    const merged = mergeSettings(
      { notifications: { stuckThresholdMinutes: NaN } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckThresholdMinutes).toBe(10);
  });

  it("falls back to base when stuckRepeatMinutes is Infinity", () => {
    const merged = mergeSettings(
      { notifications: { stuckRepeatMinutes: Infinity } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckRepeatMinutes).toBe(30);
  });

  it("falls back to base when minutes are non-number from corrupted JSON", () => {
    const merged = mergeSettings(
      { notifications: { stuckThresholdMinutes: "5" as unknown as number } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckThresholdMinutes).toBe(10);
  });

  it("preserves explicit false on boolean fields (??, not ||)", () => {
    const merged = mergeSettings(
      { notifications: { enabled: false, sound: false } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.enabled).toBe(false);
    expect(merged.notifications.sound).toBe(false);
  });

  it("does not mutate the base object", () => {
    const baseCopy: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    mergeSettings(
      { notifications: { stuckThresholdMinutes: 99 } },
      baseCopy
    );
    expect(baseCopy.notifications.stuckThresholdMinutes).toBe(10);
  });
});
