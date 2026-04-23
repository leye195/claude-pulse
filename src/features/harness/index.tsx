import { EmptyState } from "@/shared/components/EmptyState";
import { useHarnessData } from "@/shared/hooks/useHarnessData";
import type { HistoryEntry } from "@/shared/types/history";
import { useMemo } from "react";
import { HarnessGradeChart } from "./components/HarnessGradeChart";
import { HarnessSummaryCards } from "./components/HarnessSummaryCards";
import { HarnessTable } from "./components/HarnessTable";

interface HarnessTabProps {
  historyData: HistoryEntry[] | null;
  historyLoading: boolean;
}

export function HarnessTab({ historyData, historyLoading }: HarnessTabProps) {
  const projectPaths = useMemo(() => {
    if (!historyData) return [];
    return Array.from(new Set(historyData.map((e) => e.project).filter(Boolean)));
  }, [historyData]);

  const { data, loading, error, retry } = useHarnessData(projectPaths);

  if (historyLoading || loading) {
    return <div className="text-(--text-secondary) text-center py-12">로딩 중...</div>;
  }

  if (error) {
    return <EmptyState message={error} onRetry={() => retry()} />;
  }

  if (projectPaths.length === 0) {
    return (
      <EmptyState message="채점할 프로젝트가 없습니다. 프롬프트 히스토리에서 프로젝트 경로를 찾을 수 없습니다." />
    );
  }

  return (
    <>
      <HarnessSummaryCards scores={data} />
      <div className="mb-6">
        <HarnessGradeChart scores={data} />
      </div>
      <HarnessTable scores={data} />
    </>
  );
}
