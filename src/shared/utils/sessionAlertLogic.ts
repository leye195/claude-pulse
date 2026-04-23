import type { AppSettings } from "@/shared/types/settings";

export interface SessionInput {
  sessionId: string;
  isActive: boolean;
  projectName: string;
}

export interface SessionTrackState {
  sessionId: string;
  lastStatus: "active" | "idle";
  activeSince: number | null;
  lastStuckAlertAt: number | null;
  hasFiredCompletionAlert: boolean;
}

export type Alert =
  | { type: "completion"; sessionId: string; projectName: string }
  | {
      type: "stuck";
      sessionId: string;
      projectName: string;
      activeMinutes: number;
    };

export interface EvaluateResult {
  newState: Map<string, SessionTrackState>;
  alerts: Alert[];
}

export function evaluate(
  prevState: Map<string, SessionTrackState>,
  current: SessionInput[],
  settings: AppSettings,
  now: number
): EvaluateResult {
  const newState = new Map<string, SessionTrackState>();
  const alerts: Alert[] = [];

  for (const s of current) {
    const existing = prevState.get(s.sessionId);

    if (!existing) {
      newState.set(s.sessionId, {
        sessionId: s.sessionId,
        lastStatus: s.isActive ? "active" : "idle",
        activeSince: s.isActive ? now : null,
        lastStuckAlertAt: null,
        hasFiredCompletionAlert: !s.isActive,
      });
      continue;
    }

    const next: SessionTrackState = { ...existing };

    if (existing.lastStatus === "active" && !s.isActive) {
      // ⚡ → 💤
      if (!existing.hasFiredCompletionAlert && settings.notifications.completionAlert) {
        alerts.push({
          type: "completion",
          sessionId: s.sessionId,
          projectName: s.projectName,
        });
      }
      next.lastStatus = "idle";
      next.activeSince = null;
      next.lastStuckAlertAt = null;
      next.hasFiredCompletionAlert = true;
    } else if (existing.lastStatus === "idle" && s.isActive) {
      // 💤 → ⚡
      next.lastStatus = "active";
      next.activeSince = now;
      next.lastStuckAlertAt = null;
      next.hasFiredCompletionAlert = false;
    } else if (s.isActive) {
      // Still active — check stuck threshold.
      // Invariant: a session in the "active" branch must have a non-null
      // activeSince (set on registration or 💤→⚡ transition). The fallback
      // exists only as a defensive net for clock-skew or unexpected state.
      const since = next.activeSince ?? now;
      next.activeSince = since;
      if (settings.notifications.stuckAlert) {
        // Math.max guards against negative deltas when the system clock
        // jumps backwards (NTP correction); a negative elapsed never
        // crosses the threshold.
        const elapsedMs = Math.max(0, now - since);
        const thresholdMs = settings.notifications.stuckThresholdMinutes * 60_000;
        const repeatMs = settings.notifications.stuckRepeatMinutes * 60_000;
        if (elapsedMs >= thresholdMs) {
          const lastFired = next.lastStuckAlertAt;
          const shouldFire = lastFired === null ? true : now - lastFired >= repeatMs;
          if (shouldFire) {
            alerts.push({
              type: "stuck",
              sessionId: s.sessionId,
              projectName: s.projectName,
              // Round (not floor) for user-facing copy: at 10m55s the
              // notification reads "11분째" not "10분째".
              activeMinutes: Math.round(elapsedMs / 60_000),
            });
            next.lastStuckAlertAt = now;
          }
        }
      }
    }

    newState.set(s.sessionId, next);
  }

  // sessions that disappeared are simply not added to newState
  return { newState, alerts };
}
