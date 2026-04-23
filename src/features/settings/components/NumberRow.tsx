import { useEffect, useState } from "react";

interface NumberRowProps {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
}

export function NumberRow({
  label,
  value,
  disabled,
  min = 1,
  max = 1440,
  onCommit,
}: NumberRowProps) {
  const [draft, setDraft] = useState<string>(String(value));

  // Sync from prop only when the upstream value actually changes externally
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <label className={`flex items-center justify-between py-2 ${disabled ? "opacity-50" : ""}`}>
      <span className="text-sm text-(--text-primary)">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-16 px-2 py-1 text-sm rounded border border-(--border) bg-(--bg-primary) text-(--text-primary)"
        />
        <span className="text-xs text-(--text-secondary)">분</span>
      </div>
    </label>
  );
}
