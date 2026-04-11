import { useMemo } from "react";
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
  getHourlyActivityByProject,
  getProjectNames,
  PROJECT_COLORS,
} from "../utils/historyParser";

interface HourlyChartProps {
  entries: HistoryEntry[];
}

export function HourlyChart({ entries }: HourlyChartProps) {
  const chartData = useMemo(() => getHourlyActivityByProject(entries), [entries]);
  const projectNames = useMemo(() => getProjectNames(entries), [entries]);

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5">
      <span className="text-sm font-semibold text-(--text-primary) block mb-4">
        시간대별 사용 패턴
      </span>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="hour"
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
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
          {projectNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="hourly"
              fill={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
