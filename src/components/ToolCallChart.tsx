import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyActivity } from "../types/stats";
import { filterByDateRange, getToolCallData } from "../utils/statsParser";

interface ToolCallChartProps {
  dailyActivity: DailyActivity[];
}

const PERIODS = [
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "전체", days: 0 },
] as const;

export function ToolCallChart({ dailyActivity }: ToolCallChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const today = new Date().toISOString().slice(0, 10);

  const allData = useMemo(() => getToolCallData(dailyActivity), [dailyActivity]);

  const chartData = useMemo(() => {
    if (selectedPeriod === 0) return allData;
    const filtered = filterByDateRange(
      allData.map((d) => ({ date: d.date, tokens: 0 })),
      selectedPeriod,
      today
    );
    const dateSet = new Set(filtered.map((d) => d.date));
    return allData.filter((d) => dateSet.has(d.date));
  }, [allData, selectedPeriod, today]);

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return String(value);
  };

  if (allData.length === 0) return null;

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5 mt-6">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-(--text-primary)">도구 호출 통계</span>
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
      <p className="text-xs text-(--text-secondary) mb-4">
        파일 읽기·편집, 명령 실행, 검색 등 Claude가 사용한 도구 수. 비율이 높을수록 자율적으로
        작업한 정도가 큼
      </p>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatYAxis}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${v}`}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
            formatter={(value, name, props) => {
              if (name === "메시지당 호출") return [`${Number(value).toFixed(2)}x`, name];
              if (name === "도구 호출") {
                const messages = props.payload?.messages ?? 0;
                return [
                  `${Number(value).toLocaleString()}회 (메시지 ${messages.toLocaleString()}개)`,
                  name,
                ];
              }
              return [Number(value).toLocaleString(), name];
            }}
            labelFormatter={(label) => label}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
          <Bar
            yAxisId="left"
            dataKey="toolCalls"
            name="도구 호출"
            fill="#3b82f6"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="right"
            dataKey="ratio"
            name="메시지당 호출"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
