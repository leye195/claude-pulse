import type { HistoryEntry } from "@/shared/types/history";
import { EmptyState } from "@/shared/components/EmptyState";
import { HourlyChart } from "./components/HourlyChart";
import { ProjectActivityTrend } from "./components/ProjectActivityTrend";
import { ProjectBreakdown } from "./components/ProjectBreakdown";
import { ProjectSummaryCards } from "./components/ProjectSummaryCards";
import { WeekdayHeatmap } from "./components/WeekdayHeatmap";

interface ProjectsTabProps {
  data: HistoryEntry[] | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function ProjectsTab({ data, loading, error, retry }: ProjectsTabProps) {
  if (loading) {
    return <div className="text-(--text-secondary) text-center py-12">로딩 중...</div>;
  }

  if (error) {
    return <EmptyState message={error} onRetry={retry} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState message="프로젝트 활동 기록이 없습니다." />;
  }

  return (
    <>
      <ProjectSummaryCards entries={data} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ProjectActivityTrend entries={data} />
        <ProjectBreakdown entries={data} />
      </div>
      <HourlyChart entries={data} />
      <WeekdayHeatmap entries={data} />
    </>
  );
}
