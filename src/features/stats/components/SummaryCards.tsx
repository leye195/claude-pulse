import { useAnimatedNumber } from "@/shared/hooks/useAnimatedNumber";
import type { StatsData } from "@/shared/types/stats";
import { getTotalTokensForDate } from "@/shared/utils/statsParser";

interface SummaryCardsProps {
  data: StatsData;
}

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(3)}`;
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

  // Cost cards
  const dailyCosts = data.dailyCosts ?? {};
  const costDates = Object.keys(dailyCosts).sort();
  const todayCost = dailyCosts[today];
  const hasTodayCost = todayCost !== undefined && todayCost > 0;
  const latestCostDate = costDates.length > 0 ? costDates[costDates.length - 1] : null;
  const displayCost = hasTodayCost ? todayCost : latestCostDate ? dailyCosts[latestCostDate] : 0;
  const costDate = hasTodayCost
    ? "오늘"
    : latestCostDate
      ? latestCostDate.slice(5).replace("-", "/")
      : "";
  const costLabel = hasTodayCost ? "오늘 비용" : `최근 비용 (${costDate})`;
  const totalCost = data.totalCost ?? 0;

  const animTokens = useAnimatedNumber(displayTokens);
  const animMessages = useAnimatedNumber(displayMessages);
  const animDisplayCost = useAnimatedNumber(displayCost);
  const animTotalCost = useAnimatedNumber(totalCost);

  const cards = [
    { label: tokenLabel, value: animTokens.toLocaleString(), color: "text-blue-400" },
    { label: messageLabel, value: animMessages.toLocaleString(), color: "text-green-400" },
    { label: costLabel, value: formatCost(animDisplayCost), color: "text-purple-400" },
    { label: "총 비용", value: formatCost(animTotalCost), color: "text-orange-400" },
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
