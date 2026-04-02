import { useStatsData } from "./hooks/useStatsData";
import { useTheme } from "./hooks/useTheme";
import { TopBar } from "./components/TopBar";
import { SummaryCards } from "./components/SummaryCards";
import { ContributionGraph } from "./components/ContributionGraph";
import { DailyChart } from "./components/DailyChart";
import { ModelBreakdown } from "./components/ModelBreakdown";
import { EmptyState } from "./components/EmptyState";

export function App() {
  const { data, loading, error, retry } = useStatsData();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">
        로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <TopBar totalMessages={0} totalSessions={0} theme={theme} onToggleTheme={toggleTheme} />
        <EmptyState message={error} onRetry={retry} />
      </div>
    );
  }

  if (!data || data.dailyActivity.length === 0) {
    return (
      <div className="p-6">
        <TopBar totalMessages={0} totalSessions={0} theme={theme} onToggleTheme={toggleTheme} />
        <EmptyState message="아직 사용 기록이 없습니다." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <TopBar
        totalMessages={data.totalMessages}
        totalSessions={data.totalSessions}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <SummaryCards data={data} />
      <ContributionGraph
        dailyModelTokens={data.dailyModelTokens}
        firstSessionDate={data.firstSessionDate}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyChart dailyModelTokens={data.dailyModelTokens} />
        <ModelBreakdown modelUsage={data.modelUsage} />
      </div>
    </div>
  );
}
