export interface NotificationSettings {
  enabled: boolean;
  completionAlert: boolean;
  stuckAlert: boolean;
  stuckThresholdMinutes: number;
  stuckRepeatMinutes: number;
  sound: boolean;
}

export interface AppSettings {
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: AppSettings = Object.freeze({
  notifications: Object.freeze({
    enabled: true,
    completionAlert: true,
    stuckAlert: true,
    stuckThresholdMinutes: 10,
    stuckRepeatMinutes: 30,
    sound: true,
  }),
}) as AppSettings;

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function clampMin(value: unknown, min: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, value);
}

export function mergeSettings(partial: DeepPartial<AppSettings>, base: AppSettings): AppSettings {
  const partialNotif = partial.notifications ?? {};
  const baseNotif = base.notifications;
  return {
    notifications: {
      enabled: partialNotif.enabled ?? baseNotif.enabled,
      completionAlert: partialNotif.completionAlert ?? baseNotif.completionAlert,
      stuckAlert: partialNotif.stuckAlert ?? baseNotif.stuckAlert,
      stuckThresholdMinutes: clampMin(
        partialNotif.stuckThresholdMinutes,
        1,
        baseNotif.stuckThresholdMinutes
      ),
      stuckRepeatMinutes: clampMin(
        partialNotif.stuckRepeatMinutes,
        1,
        baseNotif.stuckRepeatMinutes
      ),
      sound: partialNotif.sound ?? baseNotif.sound,
    },
  };
}
