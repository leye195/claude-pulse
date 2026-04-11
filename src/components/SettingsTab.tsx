import { useEffect, useRef, useState } from "react";
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
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`flex items-center justify-between py-2 ${disabled ? "opacity-50" : ""}`}>
      <span className="text-sm text-(--text-primary)">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchNotifications = (patch: Partial<NotificationSettings>) => {
    update({ notifications: { ...settings.notifications, ...patch } });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 800);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
            onChange={(v) => patchNotifications({ stuckThresholdMinutes: v })}
          />
          <NumberRow
            label="재알림 간격"
            value={n.stuckRepeatMinutes}
            disabled={stuckSubDisabled}
            onChange={(v) => patchNotifications({ stuckRepeatMinutes: v })}
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
