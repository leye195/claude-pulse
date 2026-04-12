import type { StatsData } from "@/shared/types/stats";
import { EmptyState } from "@/shared/components/EmptyState";
import { ContributionGraph } from "./components/ContributionGraph";
import { DailyChart } from "./components/DailyChart";
import { ModelBreakdown } from "./components/ModelBreakdown";
import { SummaryCards } from "./components/SummaryCards";
import { ToolCallChart } from "./components/ToolCallChart";

interface StatsTabProps {
  data: StatsData | null;
  error: string | null;
  retry: () => void;
}

export function StatsTab({ data, error, retry }: StatsTabProps) {
  if (error) {
    return <EmptyState message={error} onRetry={retry} />;
  }

  if (!data || data.dailyActivity.length === 0) {
    return <EmptyState message="아직 사용 기록이 없습니다." />;
  }

  return (
    <>
      <SummaryCards data={data} />
      <ContributionGraph
        dailyModelTokens={data.dailyModelTokens}
        firstSessionDate={data.firstSessionDate}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyChart dailyModelTokens={data.dailyModelTokens} />
        <ModelBreakdown modelUsage={data.modelUsage} />
      </div>
      <ToolCallChart dailyActivity={data.dailyActivity} />
    </>
  );
}
