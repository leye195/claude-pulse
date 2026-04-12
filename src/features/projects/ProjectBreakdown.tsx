import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { HistoryEntry } from "@/shared/types/history";
import { getProjectSummaries, PROJECT_COLORS } from "@/shared/utils/historyParser";

interface ProjectBreakdownProps {
  entries: HistoryEntry[];
}

export function ProjectBreakdown({ entries }: ProjectBreakdownProps) {
  const breakdown = useMemo(() => {
    const summaries = getProjectSummaries(entries);
    const total = summaries.reduce((s, p) => s + p.messageCount, 0);
    if (total === 0) return [];
    return summaries.map((p) => ({
      name: p.projectName,
      messages: p.messageCount,
      sessions: p.sessionCount,
      activeDays: p.activeDays,
      percentage: Math.round((p.messageCount / total) * 1000) / 10,
    }));
  }, [entries]);

  if (breakdown.length === 0) return null;

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5">
      <span className="text-sm font-semibold text-(--text-primary) block mb-4">
        프로젝트별 사용 비율
      </span>

      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={breakdown}
              dataKey="messages"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
            >
              {breakdown.map((_, i) => (
                <Cell key={i} fill={PROJECT_COLORS[i % PROJECT_COLORS.length]} />
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
              formatter={(value, _name, props) => {
                const item = props.payload;
                return [
                  `${Number(value).toLocaleString()} 메시지 · ${item.sessions} 세션 · ${item.activeDays}일`,
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {breakdown.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
              />
              <span className="text-sm text-(--text-primary)">{entry.name}</span>
              <span className="text-xs text-(--text-secondary)">
                {entry.percentage}% ({entry.messages.toLocaleString()})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
