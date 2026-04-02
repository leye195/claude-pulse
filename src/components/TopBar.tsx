import { ThemeToggle } from "./ThemeToggle";

interface TopBarProps {
  totalMessages: number;
  totalSessions: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function TopBar({ totalMessages, totalSessions, theme, onToggleTheme }: TopBarProps) {
  return (
    <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--border)]">
      <span className="text-xl font-semibold text-[var(--text-primary)]">
        Claude Analysis
      </span>
      <div className="flex items-center gap-3">
        <span className="bg-[var(--badge-bg)] px-3 py-1 rounded-md text-sm text-[var(--text-secondary)]">
          Total: {totalMessages.toLocaleString()} messages
        </span>
        <span className="bg-[var(--badge-bg)] px-3 py-1 rounded-md text-sm text-[var(--text-secondary)]">
          {totalSessions} sessions
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  );
}
