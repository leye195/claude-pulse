import { useEffect, useState } from "react";
import { ProjectsTab } from "@/features/projects/ProjectsTab";
import { SettingsTab } from "@/features/settings/SettingsTab";
import { StatsTab } from "@/features/stats/StatsTab";
import { TabBar, type TabType } from "@/shared/components/TabBar";
import { TopBar } from "@/shared/components/TopBar";
import { useHistoryData } from "@/shared/hooks/useHistoryData";
import { useStatsData } from "@/shared/hooks/useStatsData";
import { useTheme } from "@/shared/hooks/useTheme";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>("stats");

  const { data, loading, error, retry } = useStatsData();
  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    retry: historyRetry,
  } = useHistoryData();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSetActiveTab((tab) => {
      setActiveTab(tab);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-(--text-secondary)">
        로딩 중...
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

        {activeTab === "stats" && <StatsTab data={data} error={error} retry={retry} />}
        {activeTab === "projects" && (
          <ProjectsTab
            data={historyData}
            loading={historyLoading}
            error={historyError}
            retry={historyRetry}
          />
        )}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
