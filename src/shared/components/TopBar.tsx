import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { useAnimatedNumber } from "@/shared/hooks/useAnimatedNumber";

interface TopBarProps {
  totalMessages: number;
  totalSessions: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function TopBar({ totalMessages, totalSessions, theme, onToggleTheme }: TopBarProps) {
  const animMessages = useAnimatedNumber(totalMessages);
  const animSessions = useAnimatedNumber(totalSessions);

  return (
    <div
      className="flex items-center justify-between pb-4 mb-6 border-b border-(--border)"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="text-xl font-semibold text-(--text-primary) pl-16">Claude Pulse</span>
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <span className="bg-(--badge-bg) px-3 py-1 rounded-md text-sm text-(--text-secondary)">
          Total: {animMessages.toLocaleString()} messages
        </span>
        <span className="bg-(--badge-bg) px-3 py-1 rounded-md text-sm text-(--text-secondary)">
          {animSessions.toLocaleString()} sessions
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  );
}
