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
import type { DailyModelTokens } from "@/types/stats";
import { filterByDateRange, formatModelName, getDailyTokensArray } from "@/utils/statsParser";

interface DailyChartProps {
  dailyModelTokens: DailyModelTokens[];
}

const PERIODS = [
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "전체", days: 0 },
] as const;

const MODEL_COLORS: Record<string, string> = {
  Opus: "#a855f7",
  Sonnet: "#3b82f6",
  Haiku: "#22c55e",
};

function getModelColor(name: string): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (name.startsWith(key)) return color;
  }
  return "#8b949e";
}

export function DailyChart({ dailyModelTokens }: DailyChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [stacked, setStacked] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const modelNames = useMemo(() => {
    const names = new Set<string>();
    dailyModelTokens.forEach((entry) => {
      Object.keys(entry.tokensByModel).forEach((m) => names.add(formatModelName(m)));
    });
    return Array.from(names).sort();
  }, [dailyModelTokens]);

  const allTokens = useMemo(() => getDailyTokensArray(dailyModelTokens), [dailyModelTokens]);

  const stackedData = useMemo(() => {
    return dailyModelTokens.map((entry) => {
      const row: Record<string, string | number> = { date: entry.date };
      Object.entries(entry.tokensByModel).forEach(([modelId, tokens]) => {
        const name = formatModelName(modelId);
        row[name] = ((row[name] as number) || 0) + tokens;
      });
      return row;
    });
  }, [dailyModelTokens]);

  const chartData = useMemo((): Record<string, string | number>[] => {
    if (stacked) {
      if (selectedPeriod === 0) return stackedData;
      const ref = new Date(today);
      const cutoff = new Date(ref);
      cutoff.setDate(cutoff.getDate() - selectedPeriod + 1);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      return stackedData.filter((d) => (d.date as string) >= cutoffStr);
    }
    return filterByDateRange(allTokens, selectedPeriod, today).map(({ date, tokens }) => ({
      date,
      tokens,
    }));
  }, [stacked, stackedData, allTokens, selectedPeriod, today]);

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return String(value);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-(--text-primary)">일별 토큰 사용량</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStacked((s) => !s)}
            className={`px-3 py-1 rounded text-xs cursor-pointer transition-colors ${
              stacked
                ? "bg-(--badge-bg) text-purple-400 border border-purple-400"
                : "bg-(--badge-bg) text-(--text-secondary) border border-transparent"
            }`}
          >
            모델별
          </button>
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
            tickFormatter={formatYAxis}
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
            formatter={(value, name) => [
              Number(value).toLocaleString() + " tokens",
              name === "tokens" ? "토큰" : name,
            ]}
            labelFormatter={(label) => label}
          />
          {stacked ? (
            <>
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
              {modelNames.map((name) => (
                <Bar key={name} dataKey={name} stackId="models" fill={getModelColor(name)} />
              ))}
            </>
          ) : (
            <Bar dataKey="tokens" fill="var(--grass-3)" radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
