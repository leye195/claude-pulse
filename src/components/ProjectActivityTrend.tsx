import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryEntry } from "../types/history";
import {
  filterHistoryByDateRange,
  getProjectDailyActivity,
  getProjectNames,
  PROJECT_COLORS,
} from "../utils/historyParser";

interface ProjectActivityTrendProps {
  entries: HistoryEntry[];
}

const PERIODS = [
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "전체", days: 0 },
] as const;

export function ProjectActivityTrend({ entries }: ProjectActivityTrendProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  const filtered = useMemo(
    () => filterHistoryByDateRange(entries, selectedPeriod),
    [entries, selectedPeriod]
  );

  const chartData = useMemo(() => getProjectDailyActivity(filtered), [filtered]);
  const projectNames = useMemo(() => getProjectNames(entries), [entries]);

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-(--text-primary)">프로젝트별 활동 추이</span>
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              onClick={() => setSelectedPeriod(period.days)}
              className={`px-3 py-1 rounded text-xs cursor-pointer transition-colors ${
                selectedPeriod === period.days
                  ? "bg-(--badge-bg) text-blue-400 border border-blue-400"
                  : "bg-(--badge-bg) text-(--text-secondary) border border-transparent"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
            formatter={(value, name) => [`${Number(value)} 메시지`, name]}
            labelFormatter={(label) => label}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
          {projectNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="projects"
              fill={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
