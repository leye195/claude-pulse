export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId?: string;
  pastedContents?: Record<string, unknown>;
}

export interface ProjectSummary {
  project: string;
  projectName: string;
  messageCount: number;
  sessionCount: number;
  activeDays: number;
}
