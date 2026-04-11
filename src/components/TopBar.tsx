import { ThemeToggle } from "./ThemeToggle";

interface TopBarProps {
  totalMessages: number;
  totalSessions: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function TopBar({ totalMessages, totalSessions, theme, onToggleTheme }: TopBarProps) {
  return (
    <div
      className="flex items-center justify-between pb-4 mb-6 border-b border-(--border)"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="text-xl font-semibold text-(--text-primary) pl-16">Claude Analysis</span>
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <span className="bg-(--badge-bg) px-3 py-1 rounded-md text-sm text-(--text-secondary)">
          Total: {totalMessages.toLocaleString()} messages
        </span>
        <span className="bg-(--badge-bg) px-3 py-1 rounded-md text-sm text-(--text-secondary)">
          {totalSessions} sessions
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  );
}
