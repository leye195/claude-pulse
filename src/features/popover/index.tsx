import { useStatsData } from "@/shared/hooks/useStatsData";
import { useTheme } from "@/shared/hooks/useTheme";
import type { StatsData } from "@/shared/types/stats";
import { getDailyTokensArray } from "@/shared/utils/statsParser";
import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { MiniContribution } from "./components/MiniContribution";
import { SessionList, useSessions } from "./components/SessionList";
import { StatCard } from "./components/StatCard";

const TOOLTIP_STYLE = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 12,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function getStats(data: StatsData) {
  const totalTokens = Object.values(data.modelUsage).reduce(
    (sum, m) => sum + m.inputTokens + m.outputTokens,
    0
  );
  const totalToolCalls = data.dailyActivity.reduce((sum, d) => sum + d.toolCallCount, 0);
  const firstDate = new Date(data.firstSessionDate);
  const daysSinceFirst = Math.max(
    1,
    Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    totalTokens,
    totalMessages: data.totalMessages,
    totalSessions: data.totalSessions,
    totalToolCalls,
    daysSinceFirst,
    longestSessionMs: data.longestSession?.duration ?? 0,
  };
}

function getLast7Days(data: StatsData) {
  const tokens = getDailyTokensArray(data.dailyModelTokens);
  return tokens.slice(-7).map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    tokens: d.tokens,
  }));
}

export function PopoverApp() {
  useTheme();
  const { data } = useStatsData();
  const sessions = useSessions();

  const stats = useMemo(() => (data ? getStats(data) : null), [data]);
  const last7 = useMemo(() => (data ? getLast7Days(data) : []), [data]);

  return (
    <div className="w-[360px] h-[600px] bg-(--bg-primary) text-(--text-primary) overflow-y-auto">
      <header className="sticky top-0 z-10 h-10 px-4 flex items-center justify-between border-b border-(--border) bg-(--bg-primary)">
        <span className="text-sm font-semibold">Claude Pulse</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.electronAPI.showMainWindowTab("settings")}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-(--badge-bg) cursor-pointer transition-colors"
            title="설정"
            aria-label="설정"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI.showMainWindow()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-(--badge-bg) cursor-pointer transition-colors"
            title="메인 창 열기"
            aria-label="메인 창 열기"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        </div>
      </header>

      <SessionList sessions={sessions} />

      {stats && data ? (
        <>
          <section className="px-4 py-3 border-b border-(--border)">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="총 토큰" value={formatNumber(stats.totalTokens)} />
              <StatCard label="총 메시지" value={formatNumber(stats.totalMessages)} />
              <StatCard label="총 세션" value={stats.totalSessions.toLocaleString()} />
              <StatCard label="총 도구 호출" value={formatNumber(stats.totalToolCalls)} />
            </div>
            <div className="mt-3 text-[11px] text-(--text-secondary) space-y-0.5">
              <div>사용 기간: {stats.daysSinceFirst}일</div>
              <div>최장 세션: {formatDuration(stats.longestSessionMs)}</div>
            </div>
          </section>

          <section className="px-4 py-3 border-b border-(--border)">
            <div className="text-xs text-(--text-secondary) mb-2">최근 6개월</div>
            <div className="flex justify-center">
              <MiniContribution data={data} />
            </div>
          </section>

          <section className="px-4 py-3">
            <div className="text-xs text-(--text-secondary) mb-2">최근 7일</div>
            <div style={{ width: "100%", height: 80 }}>
              <ResponsiveContainer>
                <BarChart data={last7} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "var(--text-secondary)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--badge-bg)" }}
                    formatter={(value) => [`${Number(value).toLocaleString()} 토큰`, ""]}
                  />
                  <Bar dataKey="tokens" fill="var(--grass-3)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : (
        <div className="px-4 py-6 text-xs text-(--text-secondary)">데이터를 불러오는 중...</div>
      )}
    </div>
  );
}
