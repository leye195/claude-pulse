import { useMemo, useState } from "react";
import type { HistoryEntry } from "@/types/history";
import { getWeekdayHourlyHeatmap } from "@/utils/historyParser";
import { getContributionLevel } from "@/utils/statsParser";

interface WeekdayHeatmapProps {
  entries: HistoryEntry[];
}

const CELL_SIZE = 18;
const CELL_GAP = 2;
const STEP = CELL_SIZE + CELL_GAP;
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
// Reorder: Mon~Sun for display (index 1,2,3,4,5,6,0)
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const COLORS = [
  "var(--grass-0)",
  "var(--grass-1)",
  "var(--grass-2)",
  "var(--grass-3)",
  "var(--grass-4)",
];

export function WeekdayHeatmap({ entries }: WeekdayHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    day: string;
    hour: number;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const cells = useMemo(() => getWeekdayHourlyHeatmap(entries), [entries]);
  const maxCount = useMemo(() => Math.max(...cells.map((c) => c.count), 0), [cells]);

  const LEFT_PADDING = 28;
  const TOP_PADDING = 24;
  const svgWidth = LEFT_PADDING + 24 * STEP;
  const svgHeight = TOP_PADDING + 7 * STEP;

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5 mt-6 relative">
      <span className="text-sm font-semibold text-(--text-primary) block mb-4">
        요일별 활동 패턴
      </span>

      <div className="overflow-x-auto flex justify-center">
        <svg width={svgWidth} height={svgHeight + 4} className="block">
          {/* Hour labels (top) */}
          {Array.from({ length: 24 }, (_, h) => (
            <text
              key={h}
              x={LEFT_PADDING + h * STEP + CELL_SIZE / 2}
              y={14}
              fill="var(--text-secondary)"
              fontSize={10}
              textAnchor="middle"
            >
              {h % 3 === 0 || h === 23 ? `${h}` : ""}
            </text>
          ))}

          {/* Day labels (left) */}
          {DISPLAY_ORDER.map((day, row) => (
            <text
              key={day}
              x={0}
              y={TOP_PADDING + row * STEP + CELL_SIZE / 2 + 4}
              fill="var(--text-secondary)"
              fontSize={11}
            >
              {DAY_LABELS[day]}
            </text>
          ))}

          {/* Cells */}
          {DISPLAY_ORDER.map((day, row) =>
            Array.from({ length: 24 }, (_, hour) => {
              const cell = cells.find((c) => c.day === day && c.hour === hour);
              const count = cell?.count ?? 0;
              const level = getContributionLevel(count, maxCount);
              const x = LEFT_PADDING + hour * STEP;
              const y = TOP_PADDING + row * STEP;

              return (
                <rect
                  key={`${day}-${hour}`}
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={4}
                  fill={COLORS[level]}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({
                      day: DAY_LABELS[day],
                      hour,
                      count,
                      x: rect.x + rect.width / 2,
                      y: rect.y,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          )}
        </svg>
      </div>

      <div className="flex items-center justify-end gap-1 mt-3 text-xs text-(--text-secondary)">
        <span>Less</span>
        {COLORS.map((color, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ background: color }} />
        ))}
        <span>More</span>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-(--text-primary) text-(--bg-primary) text-xs px-2 py-1 rounded pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 30, transform: "translateX(-50%)" }}
        >
          {tooltip.day}요일 {tooltip.hour}시: {tooltip.count}건
        </div>
      )}
    </div>
  );
}
