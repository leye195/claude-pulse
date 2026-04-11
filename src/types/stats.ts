import type { TabType } from "../components/TabBar";
import type { HistoryEntry } from "./history";
import type { AppSettings, DeepPartial } from "./settings";

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface LongestSession {
  sessionId: string;
  duration: number;
  messageCount: number;
  timestamp: string;
}

export interface StatsData {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession: LongestSession;
  firstSessionDate: string;
  hourCounts: Record<string, number>;
  totalSpeculationTimeSavedMs: number;
}

export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  projectName: string;
  startedAt: number;
  name?: string;
  cpuPercent: number;
  isActive: boolean;
}

export interface ElectronAPI {
  getStatsData: () => Promise<StatsData | null>;
  onStatsUpdated: (callback: (data: StatsData) => void) => () => void;
  getHistoryData: () => Promise<HistoryEntry[] | null>;
  onHistoryUpdated: (callback: (data: HistoryEntry[]) => void) => () => void;
  getSessions: () => Promise<ActiveSession[]>;
  onSessionsUpdated: (callback: (data: ActiveSession[]) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (partial: DeepPartial<AppSettings>) => Promise<AppSettings>;
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void;
  showMainWindow: () => void;
  showMainWindowTab: (tab: TabType) => void;
  onSetActiveTab: (callback: (tab: TabType) => void) => () => void;
  notifyThemeChanged: (theme: "light" | "dark") => void;
  onThemeChanged: (callback: (theme: "light" | "dark") => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
