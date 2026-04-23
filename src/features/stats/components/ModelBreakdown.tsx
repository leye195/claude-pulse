import type { ModelUsage } from "@/shared/types/stats";
import { getModelBreakdown } from "@/shared/utils/statsParser";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ModelBreakdownProps {
  modelUsage: Record<string, ModelUsage>;
}

const MODEL_COLORS: Record<string, string> = {
  Opus: "#a855f7",
  Sonnet: "#3b82f6",
  Haiku: "#22c55e",
};

function getColor(name: string, index: number): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (name.startsWith(key)) return color;
  }
  const fallback = ["#f59e0b", "#ef4444", "#8b949e"];
  return fallback[index % fallback.length];
}

export function ModelBreakdown({ modelUsage }: ModelBreakdownProps) {
  const breakdown = useMemo(() => getModelBreakdown(modelUsage), [modelUsage]);

  if (breakdown.length === 0) return null;

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5 mb-6">
      <span className="text-sm font-semibold text-(--text-primary) block mb-4">
        모델별 사용 비율
      </span>

      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={breakdown}
              dataKey="tokens"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
            >
              {breakdown.map((entry, i) => (
                <Cell key={entry.name} fill={getColor(entry.name, i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              formatter={(value) => [Number(value).toLocaleString() + " tokens"]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {breakdown.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: getColor(entry.name, i) }} />
              <span className="text-sm text-(--text-primary)">{entry.name}</span>
              <span className="text-xs text-(--text-secondary)">
                {entry.percentage}% ({entry.tokens.toLocaleString()})
              </span>
              {entry.costUSD > 0 && (
                <span className="text-xs text-emerald-400">
                  ${entry.costUSD >= 1 ? entry.costUSD.toFixed(2) : entry.costUSD.toFixed(3)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
