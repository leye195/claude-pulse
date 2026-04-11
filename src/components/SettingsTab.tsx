import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import type { NotificationSettings } from "../types/settings";

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between py-2 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <span className="text-sm text-(--text-primary)">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="cursor-pointer"
      />
    </label>
  );
}

function NumberRow({
  label,
  value,
  disabled,
  min = 1,
  max = 1440,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
}) {
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

export function SettingsTab() {
  const { settings, update } = useSettings();
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), 800);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  const patchNotifications = (patch: Partial<NotificationSettings>) => {
    update({ notifications: patch });
    setSavedFlash(true);
  };

  const n = settings.notifications;
  const subDisabled = !n.enabled;
  const stuckSubDisabled = subDisabled || !n.stuckAlert;

  return (
    <div className="space-y-6">
      <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-(--text-primary)">알림</h2>
          {savedFlash && <span className="text-xs text-(--text-secondary)">✓ 저장됨</span>}
        </div>
        <div className="divide-y divide-(--border)">
          <ToggleRow
            label="알림 사용"
            checked={n.enabled}
            onChange={(v) => patchNotifications({ enabled: v })}
          />
          <ToggleRow
            label="작업 완료 알림 (⚡→💤)"
            checked={n.completionAlert}
            disabled={subDisabled}
            onChange={(v) => patchNotifications({ completionAlert: v })}
          />
          <ToggleRow
            label="세션 정체 경고"
            checked={n.stuckAlert}
            disabled={subDisabled}
            onChange={(v) => patchNotifications({ stuckAlert: v })}
          />
          <NumberRow
            label="정체 임계 시간"
            value={n.stuckThresholdMinutes}
            disabled={stuckSubDisabled}
            onCommit={(v) => patchNotifications({ stuckThresholdMinutes: v })}
          />
          <NumberRow
            label="재알림 간격"
            value={n.stuckRepeatMinutes}
            disabled={stuckSubDisabled}
            onCommit={(v) => patchNotifications({ stuckRepeatMinutes: v })}
          />
          <ToggleRow
            label="정체 알림 사운드"
            checked={n.sound}
            disabled={stuckSubDisabled}
            onChange={(v) => patchNotifications({ sound: v })}
          />
        </div>
      </div>
    </div>
  );
}
