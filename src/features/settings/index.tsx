import { useSettings } from "@/shared/hooks/useSettings";
import type { NotificationSettings } from "@/shared/types/settings";
import { useEffect, useState } from "react";
import { NumberRow } from "./components/NumberRow";
import { ToggleRow } from "./components/ToggleRow";

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
