import { useMemo } from "react";
import type { StatsData } from "@/shared/types/stats";
import { getContributionLevel, getDailyTokensArray } from "@/shared/utils/statsParser";

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

export function MiniContribution({ data }: { data: StatsData }) {
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
