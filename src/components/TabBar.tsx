export type TabType = "stats" | "projects";

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: { key: TabType; label: string }[] = [
  { key: "stats", label: "사용량 분석" },
  { key: "projects", label: "프로젝트 활동" },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-1 mb-6 bg-(--badge-bg) rounded-lg p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
            activeTab === tab.key
              ? "bg-(--bg-card) text-(--text-primary) shadow-sm"
              : "text-(--text-secondary) hover:text-(--text-primary)"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
