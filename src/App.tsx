import { useEffect, useState } from "react";
import { ContributionGraph } from "./components/ContributionGraph";
import { DailyChart } from "./components/DailyChart";
import { EmptyState } from "./components/EmptyState";
import { HourlyChart } from "./components/HourlyChart";
import { ModelBreakdown } from "./components/ModelBreakdown";
import { ProjectActivityTrend } from "./components/ProjectActivityTrend";
import { ProjectBreakdown } from "./components/ProjectBreakdown";
import { ProjectSummaryCards } from "./components/ProjectSummaryCards";
import { SettingsTab } from "./components/SettingsTab";
import { SummaryCards } from "./components/SummaryCards";
import { TabBar, type TabType } from "./components/TabBar";
import { ToolCallChart } from "./components/ToolCallChart";
import { TopBar } from "./components/TopBar";
import { WeekdayHeatmap } from "./components/WeekdayHeatmap";
import { useHistoryData } from "./hooks/useHistoryData";
import { useStatsData } from "./hooks/useStatsData";
import { useTheme } from "./hooks/useTheme";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSetActiveTab((tab) => {
      setActiveTab(tab);
    });
    return unsubscribe;
  }, []);
  const { data, loading, error, retry } = useStatsData();
  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    retry: historyRetry,
  } = useHistoryData();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-(--text-secondary)">
        로딩 중...
      </div>
    );
  }

  if (error && activeTab === "stats") {
    return (
      <div className="p-6">
        <TopBar totalMessages={0} totalSessions={0} theme={theme} onToggleTheme={toggleTheme} />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <EmptyState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="max-w-300 mx-auto">
      <div
        className="fixed top-0 left-0 right-0 h-9 z-50"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="p-6 pt-9">
        <TopBar
          totalMessages={data?.totalMessages ?? 0}
          totalSessions={data?.totalSessions ?? 0}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "stats" && data && data.dailyActivity.length > 0 && (
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
        )}

        {activeTab === "stats" && (!data || data.dailyActivity.length === 0) && !error && (
          <EmptyState message="아직 사용 기록이 없습니다." />
        )}

        {activeTab === "projects" && historyLoading && (
          <div className="text-(--text-secondary) text-center py-12">로딩 중...</div>
        )}

        {activeTab === "projects" && historyError && (
          <EmptyState message={historyError} onRetry={historyRetry} />
        )}

        {activeTab === "projects" && historyData && historyData.length > 0 && (
          <>
            <ProjectSummaryCards entries={historyData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ProjectActivityTrend entries={historyData} />
              <ProjectBreakdown entries={historyData} />
            </div>
            <HourlyChart entries={historyData} />
            <WeekdayHeatmap entries={historyData} />
          </>
        )}

        {activeTab === "projects" && historyData && historyData.length === 0 && (
          <EmptyState message="프로젝트 활동 기록이 없습니다." />
        )}

        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
