import type { StatsData } from "@/types/stats";
import { getTotalTokensForDate } from "@/utils/statsParser";

interface SummaryCardsProps {
  data: StatsData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const today = new Date().toISOString().slice(0, 10);

  // Try today first, fall back to most recent date with data
  const latestTokenEntry =
    data.dailyModelTokens.length > 0
      ? data.dailyModelTokens[data.dailyModelTokens.length - 1]
      : null;
  const latestActivityEntry =
    data.dailyActivity.length > 0 ? data.dailyActivity[data.dailyActivity.length - 1] : null;

  const todayTokens = getTotalTokensForDate(data.dailyModelTokens, today);
  const todayActivity = data.dailyActivity.find((d) => d.date === today);

  const isToday = todayTokens > 0 || (todayActivity?.messageCount ?? 0) > 0;

  const displayTokens = isToday
    ? todayTokens
    : latestTokenEntry
      ? Object.values(latestTokenEntry.tokensByModel).reduce((s, t) => s + t, 0)
      : 0;
  const displayMessages = isToday
    ? (todayActivity?.messageCount ?? 0)
    : (latestActivityEntry?.messageCount ?? 0);
  const displayDate = isToday
    ? "오늘"
    : latestActivityEntry
      ? latestActivityEntry.date.slice(5).replace("-", "/")
      : "";

  const tokenLabel = isToday ? "오늘 토큰" : `최근 토큰 (${displayDate})`;
  const messageLabel = isToday ? "오늘 메시지" : `최근 메시지 (${displayDate})`;

  const firstDate = new Date(data.firstSessionDate);
  const daysSinceFirst = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  const cards = [
    { label: tokenLabel, value: displayTokens.toLocaleString(), color: "text-blue-400" },
    { label: messageLabel, value: displayMessages.toLocaleString(), color: "text-green-400" },
    { label: "총 세션", value: data.totalSessions.toLocaleString(), color: "text-purple-400" },
    { label: "사용 기간", value: `${daysSinceFirst}일`, color: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-(--bg-card) border border-(--border) rounded-lg p-4">
          <div className="text-xs text-(--text-secondary) mb-1">{card.label}</div>
          <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
