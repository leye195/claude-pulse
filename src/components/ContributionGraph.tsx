import { useMemo, useState } from "react";
import type { DailyModelTokens } from "../types/stats";
import { getDailyTokensArray, getContributionLevel } from "../utils/statsParser";

interface ContributionGraphProps {
  dailyModelTokens: DailyModelTokens[];
  firstSessionDate: string;
}

const CELL_SIZE = 12;
const CELL_GAP = 2;
const STEP = CELL_SIZE + CELL_GAP;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getWeeksData(dailyTokens: { date: string; tokens: number }[]) {
  const tokenMap = new Map(dailyTokens.map((d) => [d.date, d.tokens]));
  const today = new Date();
  const todayDay = today.getDay();

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - todayDay));

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 52 * 7 + 1);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: { date: string; tokens: number; dayOfWeek: number }[][] = [];
  let currentWeek: { date: string; tokens: number; dayOfWeek: number }[] = [];

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getDay();

    currentWeek.push({
      date: dateStr,
      tokens: tokenMap.get(dateStr) ?? 0,
      dayOfWeek,
    });

    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return weeks;
}

function getMonthLabels(weeks: { date: string; tokens: number; dayOfWeek: number }[][]) {
  const labels: { text: string; x: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, i) => {
    const firstDay = week[0];
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      labels.push({ text: MONTH_NAMES[month], x: i * STEP });
      lastMonth = month;
    }
  });

  return labels;
}

export function ContributionGraph({ dailyModelTokens }: ContributionGraphProps) {
  const [tooltip, setTooltip] = useState<{ date: string; tokens: number; x: number; y: number } | null>(null);

  const dailyTokens = useMemo(() => getDailyTokensArray(dailyModelTokens), [dailyModelTokens]);
  const weeks = useMemo(() => getWeeksData(dailyTokens), [dailyTokens]);
  const maxTokens = useMemo(
    () => Math.max(...dailyTokens.map((d) => d.tokens), 0),
    [dailyTokens]
  );
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);

  const COLORS = [
    "var(--grass-0)",
    "var(--grass-1)",
    "var(--grass-2)",
    "var(--grass-3)",
    "var(--grass-4)",
  ];

  const LEFT_PADDING = 36;
  const TOP_PADDING = 20;
  const svgWidth = LEFT_PADDING + weeks.length * STEP;
  const svgHeight = TOP_PADDING + 7 * STEP;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 mb-6 relative">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[var(--text-primary)]">토큰 사용량 잔디</span>
        <span className="text-xs text-[var(--text-secondary)]">
          {new Date().getFullYear()}년
        </span>
      </div>

      <div className="overflow-x-auto flex justify-center">
        <svg width={svgWidth} height={svgHeight + 10} className="block">
          {monthLabels.map((label, i) => (
            <text
              key={i}
              x={LEFT_PADDING + label.x}
              y={12}
              fill="var(--text-secondary)"
              fontSize={10}
            >
              {label.text}
            </text>
          ))}

          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={TOP_PADDING + i * STEP + 10}
              fill="var(--text-secondary)"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {weeks.map((week, wi) =>
            week.map((day) => {
              const level = getContributionLevel(day.tokens, maxTokens);
              const x = LEFT_PADDING + wi * STEP;
              const y = TOP_PADDING + day.dayOfWeek * STEP;
              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  fill={COLORS[level]}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({ date: day.date, tokens: day.tokens, x: rect.x, y: rect.y });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  className="cursor-pointer"
                />
              );
            })
          )}
        </svg>
      </div>

      <div className="flex items-center justify-end gap-1 mt-3 text-xs text-[var(--text-secondary)]">
        <span>Less</span>
        {COLORS.map((color, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ background: color }}
          />
        ))}
        <span>More</span>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs px-2 py-1 rounded pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 30,
          }}
        >
          {tooltip.date}: {tooltip.tokens.toLocaleString()} tokens
        </div>
      )}
    </div>
  );
}
