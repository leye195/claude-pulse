import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useStatsData } from "../hooks/useStatsData";
import { useTheme } from "../hooks/useTheme";
import type { ActiveSession, StatsData } from "../types/stats";
import { getContributionLevel, getDailyTokensArray } from "../utils/statsParser";

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

function formatElapsed(startedAt: number): string {
  const diffMs = Date.now() - startedAt;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
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

const MINI_CELL = 9;
const MINI_GAP = 2;
const MINI_STEP = MINI_CELL + MINI_GAP;
const MINI_WEEKS = 26;

function getMiniWeeks(data: StatsData) {
  const dailyTokens = getDailyTokensArray(data.dailyModelTokens);
  const tokenMap = new Map(dailyTokens.map((d) => [d.date, d.tokens]));
  const today = new Date();
  const todayDay = today.getDay();

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - todayDay));

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - MINI_WEEKS * 7 + 1);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: { date: string; tokens: number; dayOfWeek: number }[][] = [];
  let week: { date: string; tokens: number; dayOfWeek: number }[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getDay();
    week.push({
      date: dateStr,
      tokens: tokenMap.get(dateStr) ?? 0,
      dayOfWeek,
    });
    if (dayOfWeek === 6) {
      weeks.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (week.length > 0) weeks.push(week);
  const maxTokens = Math.max(...dailyTokens.map((d) => d.tokens), 0);
  return { weeks, maxTokens };
}

function MiniContribution({ data }: { data: StatsData }) {
  const { weeks, maxTokens } = useMemo(() => getMiniWeeks(data), [data]);
  const colors = [
    "var(--grass-0)",
    "var(--grass-1)",
    "var(--grass-2)",
    "var(--grass-3)",
    "var(--grass-4)",
  ];
  const width = weeks.length * MINI_STEP;
  const height = 7 * MINI_STEP;
  return (
    <svg width={width} height={height} className="block">
      {weeks.map((week, wi) =>
        week.map((day) => {
          const level = getContributionLevel(day.tokens, maxTokens);
          return (
            <rect
              key={day.date}
              x={wi * MINI_STEP}
              y={day.dayOfWeek * MINI_STEP}
              width={MINI_CELL}
              height={MINI_CELL}
              rx={2}
              fill={colors[level]}
            />
          );
        })
      )}
    </svg>
  );
}

function getLast7Days(data: StatsData) {
  const tokens = getDailyTokensArray(data.dailyModelTokens);
  return tokens.slice(-7).map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    tokens: d.tokens,
  }));
}

function useSessions(): ActiveSession[] {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);

  useEffect(() => {
    let mounted = true;
    window.electronAPI.getSessions().then((s) => {
      if (mounted) setSessions(s);
    });
    const unsubscribe = window.electronAPI.onSessionsUpdated((s) => {
      setSessions(s);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return sessions;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg px-3 py-2">
      <div className="text-[10px] text-(--text-secondary)">{label}</div>
      <div className="text-base font-semibold text-(--text-primary)">{value}</div>
    </div>
  );
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
        <span className="text-sm font-semibold">Claude Analysis</span>
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

      <section className="px-4 py-3 border-b border-(--border)">
        <div className="text-xs text-(--text-secondary) mb-2">활성 세션 ({sessions.length})</div>
        {sessions.length === 0 ? (
          <div className="text-xs text-(--text-secondary) py-2">실행 중인 세션이 없습니다</div>
        ) : (
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.sessionId} className="flex items-center gap-2 text-xs">
                <span aria-hidden>{s.isActive ? "⚡" : "💤"}</span>
                <span className="font-medium text-(--text-primary) truncate flex-1">
                  {s.projectName}
                  {s.name ? <span className="text-(--text-secondary)"> — {s.name}</span> : null}
                </span>
                <span className="text-(--text-secondary) whitespace-nowrap">
                  {formatElapsed(s.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                    formatter={(value: number) => [`${value.toLocaleString()} 토큰`, ""]}
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
