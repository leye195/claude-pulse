import type { StatsData } from "../types/stats";
import { getTotalTokensForDate } from "../utils/statsParser";

interface SummaryCardsProps {
  data: StatsData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const today = new Date().toISOString().slice(0, 10);
  const todayTokens = getTotalTokensForDate(data.dailyModelTokens, today);
  const todayActivity = data.dailyActivity.find((d) => d.date === today);
  const todayMessages = todayActivity?.messageCount ?? 0;

  const firstDate = new Date(data.firstSessionDate);
  const daysSinceFirst = Math.floor(
    (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const cards = [
    { label: "오늘 토큰", value: todayTokens.toLocaleString(), color: "text-blue-400" },
    { label: "오늘 메시지", value: todayMessages.toLocaleString(), color: "text-green-400" },
    { label: "총 세션", value: data.totalSessions.toLocaleString(), color: "text-purple-400" },
    { label: "사용 기간", value: `${daysSinceFirst}일`, color: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4"
        >
          <div className="text-xs text-[var(--text-secondary)] mb-1">{card.label}</div>
          <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
