import type { HistoryEntry } from "@/shared/types/history";
import { getProjectSummaries } from "@/shared/utils/historyParser";
import { useMemo } from "react";

interface ProjectSummaryCardsProps {
  entries: HistoryEntry[];
}

export function ProjectSummaryCards({ entries }: ProjectSummaryCardsProps) {
  const summaries = useMemo(() => getProjectSummaries(entries), [entries]);

  const totalProjects = summaries.length;
  const totalMessages = entries.length;
  const activeDays = new Set(entries.map((e) => new Date(e.timestamp).toISOString().slice(0, 10)))
    .size;
  const topProject = summaries[0]?.projectName ?? "-";

  const cards = [
    { label: "프로젝트 수", value: String(totalProjects), color: "text-blue-400" },
    { label: "총 프롬프트", value: totalMessages.toLocaleString(), color: "text-green-400" },
    { label: "활동 일수", value: `${activeDays}일`, color: "text-purple-400" },
    { label: "최다 활동", value: topProject, color: "text-orange-400" },
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
