import { Notification } from "electron";
import {
  evaluate,
  type Alert,
  type SessionInput,
  type SessionTrackState,
} from "../src/utils/sessionAlertLogic.js";
import type { AppSettings } from "../src/types/settings.js";

let state = new Map<string, SessionTrackState>();
let onClickHandler: (() => void) | null = null;

export function setAlertClickHandler(fn: () => void): void {
  onClickHandler = fn;
}

interface ProcessOptions {
  sessions: SessionInput[];
  settings: AppSettings;
  now?: number;
}

export interface ProcessResult {
  hasStuckSessions: boolean;
}

export function processSessions({
  sessions,
  settings,
  now = Date.now(),
}: ProcessOptions): ProcessResult {
  const result = evaluate(state, sessions, settings, now);
  state = result.newState;

  if (settings.notifications.enabled) {
    for (const alert of result.alerts) {
      dispatchNotification(alert, settings);
    }
  }

  let hasStuckSessions = false;
  for (const tracked of state.values()) {
    if (tracked.lastStuckAlertAt !== null) {
      hasStuckSessions = true;
      break;
    }
  }
  return { hasStuckSessions };
}

function dispatchNotification(alert: Alert, settings: AppSettings): void {
  if (!Notification.isSupported()) return;

  let title: string;
  let body: string;
  let silent: boolean;

  if (alert.type === "completion") {
    title = "작업 완료";
    body = `${alert.projectName} 작업이 완료되었습니다`;
    silent = true;
  } else {
    title = "세션 정체";
    body = `${alert.projectName} 세션이 ${alert.activeMinutes}분째 작업 중입니다`;
    silent = !settings.notifications.sound;
  }

  const n = new Notification({ title, body, silent });
  n.on("click", () => {
    if (onClickHandler) onClickHandler();
  });
  n.show();
}

export function resetAlertState(): void {
  state = new Map();
}
