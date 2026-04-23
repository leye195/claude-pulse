import type { HarnessScore } from "@/shared/types/harness";
import { useMemo } from "react";

interface HarnessSummaryCardsProps {
  scores: HarnessScore[];
}

export function HarnessSummaryCards({ scores }: HarnessSummaryCardsProps) {
  const stats = useMemo(() => {
    const scored = scores.filter((s) => s.exists);
    const total = scored.length;
    const avg = total === 0 ? 0 : Math.round(scored.reduce((acc, s) => acc + s.score, 0) / total);
    const top = scored.reduce<HarnessScore | null>(
      (best, cur) => (best === null || cur.score > best.score ? cur : best),
      null
    );
    const sCount = scored.filter((s) => s.grade === "S").length;
    return {
      avg,
      top,
      sCount,
      total,
    };
  }, [scores]);

  const cards = [
    {
      label: "평균 점수",
      value: `${stats.avg}점`,
      color: "text-blue-400",
    },
    {
      label: "최고 점수",
      value: stats.top ? `${stats.top.score}점 · ${stats.top.projectName}` : "-",
      color: "text-green-400",
    },
    {
      label: "S등급",
      value: `${stats.sCount}개`,
      color: "text-purple-400",
    },
    {
      label: "채점 프로젝트",
      value: `${stats.total}개`,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-(--bg-card) border border-(--border) rounded-lg p-4">
          <div className="text-xs text-(--text-secondary) mb-1">{card.label}</div>
          <div className={`text-2xl font-semibold ${card.color} truncate`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
