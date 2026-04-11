# Session Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 활성 Claude Code 세션의 ⚡→💤 전환 및 ⚡ 정체 상태를 감지해 macOS 시스템 알림 + 트레이 뱃지로 알리고, 사용자가 새 "설정" 탭에서 알림 동작을 조정하게 한다.

**Architecture:** Pure logic는 `src/utils/`에 두어 vitest로 TDD하고, electron main process는 그 logic을 wrap해 file I/O와 `Notification` 발사를 담당한다. 설정은 `~/.claude-pulse/settings.json`에 영속화되고, 메인↔팝오버 윈도우는 IPC `settings-updated` 브로드캐스트로 동기화된다.

**Tech Stack:** Electron 41 (Notification, Tray, ipcMain), React 19 + TanStack Query, Vitest (jsdom), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-04-12-session-alerts-design.md`

---

## File Structure

### 신규 파일

| 파일 | 책임 |
|------|------|
| `src/types/settings.ts` | `AppSettings` 타입, `DEFAULT_SETTINGS`, `mergeSettings(partial, base)` 순수 함수 |
| `src/utils/sessionAlertLogic.ts` | `evaluate(prevState, currentSessions, settings, now)` 순수 step 함수 + 알림 객체 타입 |
| `src/__tests__/settings.test.ts` | `mergeSettings` 단위 테스트 |
| `src/__tests__/sessionAlertLogic.test.ts` | `evaluate` 단위 테스트 |
| `electron/configStore.ts` | settings.json 로드/저장 (atomic write, fallback) |
| `electron/sessionAlertMonitor.ts` | 메모리 상태 보관, polling 시 logic 호출, `Notification` 발사 |
| `src/hooks/useSettings.ts` | TanStack Query 기반 설정 hook + IPC push 수신 |
| `src/components/SettingsTab.tsx` | 설정 UI (토글, 숫자 입력) |
| `build/iconTemplateAlert.png`, `iconTemplateAlert@2x.png` | 정체 알림 시 점이 추가된 트레이 아이콘 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `electron/main.ts` | configStore + sessionAlertMonitor 통합, IPC 4개 추가, tray setImage 토글, `set-active-tab` push |
| `electron/preload.ts` | 5개 API 추가 (`getSettings`, `updateSettings`, `onSettingsUpdated`, `showMainWindowTab`, `onSetActiveTab`) |
| `src/types/stats.ts` | `ElectronAPI`에 settings + tab IPC 메서드 추가 |
| `src/components/TabBar.tsx` | "설정" 탭 추가 |
| `src/App.tsx` | `TabType`에 `"settings"` 추가, IPC `set-active-tab` 수신, `SettingsTab` 렌더 |
| `src/components/PopoverApp.tsx` | 헤더에 ⚙️ 버튼 추가 |

---

## Stage 1: 설정 인프라 (Tasks 1–6)

### Task 1: settings 타입 + mergeSettings 순수 함수 (TDD)

**Files:**
- Create: `src/types/settings.ts`
- Create: `src/__tests__/settings.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from "../types/settings";

describe("DEFAULT_SETTINGS", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_SETTINGS.notifications.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.completionAlert).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.stuckAlert).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.stuckThresholdMinutes).toBe(10);
    expect(DEFAULT_SETTINGS.notifications.stuckRepeatMinutes).toBe(30);
    expect(DEFAULT_SETTINGS.notifications.sound).toBe(true);
  });
});

describe("mergeSettings", () => {
  it("returns defaults when partial is empty", () => {
    expect(mergeSettings({}, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("overrides only specified fields", () => {
    const merged = mergeSettings(
      { notifications: { stuckThresholdMinutes: 5 } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckThresholdMinutes).toBe(5);
    expect(merged.notifications.enabled).toBe(true);
    expect(merged.notifications.stuckRepeatMinutes).toBe(30);
  });

  it("ignores unknown top-level keys", () => {
    const merged = mergeSettings(
      { notifications: {}, unknown: "x" } as Partial<AppSettings>,
      DEFAULT_SETTINGS
    );
    expect((merged as Record<string, unknown>).unknown).toBeUndefined();
  });

  it("clamps stuckThresholdMinutes to >= 1", () => {
    const merged = mergeSettings(
      { notifications: { stuckThresholdMinutes: 0 } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckThresholdMinutes).toBe(1);
  });

  it("clamps stuckRepeatMinutes to >= 1", () => {
    const merged = mergeSettings(
      { notifications: { stuckRepeatMinutes: -10 } },
      DEFAULT_SETTINGS
    );
    expect(merged.notifications.stuckRepeatMinutes).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npm test -- settings.test
```

Expected: FAIL — `Cannot find module '../types/settings'`

- [ ] **Step 3: 최소 구현 작성**

`src/types/settings.ts`:

```ts
export interface NotificationSettings {
  enabled: boolean;
  completionAlert: boolean;
  stuckAlert: boolean;
  stuckThresholdMinutes: number;
  stuckRepeatMinutes: number;
  sound: boolean;
}

export interface AppSettings {
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    enabled: true,
    completionAlert: true,
    stuckAlert: true,
    stuckThresholdMinutes: 10,
    stuckRepeatMinutes: 30,
    sound: true,
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function clampMin(value: unknown, min: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, value);
}

export function mergeSettings(
  partial: DeepPartial<AppSettings>,
  base: AppSettings
): AppSettings {
  const partialNotif = partial.notifications ?? {};
  const baseNotif = base.notifications;
  return {
    notifications: {
      enabled: partialNotif.enabled ?? baseNotif.enabled,
      completionAlert: partialNotif.completionAlert ?? baseNotif.completionAlert,
      stuckAlert: partialNotif.stuckAlert ?? baseNotif.stuckAlert,
      stuckThresholdMinutes: clampMin(
        partialNotif.stuckThresholdMinutes,
        1,
        baseNotif.stuckThresholdMinutes
      ),
      stuckRepeatMinutes: clampMin(
        partialNotif.stuckRepeatMinutes,
        1,
        baseNotif.stuckRepeatMinutes
      ),
      sound: partialNotif.sound ?? baseNotif.sound,
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- settings.test
```

Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/types/settings.ts src/__tests__/settings.test.ts
git commit -m "feat(settings): add AppSettings types and mergeSettings"
```

---

### Task 2: configStore (file I/O wrapper)

**Files:**
- Create: `electron/configStore.ts`
- Modify: `electron/main.ts`
- Modify: `tsconfig.node.json`

이 task는 단위 테스트가 없다 (file I/O는 통합 검증으로 충분). 구현 후 dev 모드에서 수동 확인.

- [ ] **Step 0: tsconfig.node.json에 공유 src 파일 등록**

`electron/`이 `src/types/settings.ts`와 (다음 stage에서 추가될) `src/utils/sessionAlertLogic.ts`를 import할 수 있도록 include 목록을 확장. 이 두 파일은 DOM/React 의존성이 없는 순수 모듈이므로 node tsconfig에서 안전하게 컴파일된다.

`tsconfig.node.json`을 다음으로 교체:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "dist-electron"
  },
  "include": [
    "electron/**/*",
    "src/types/settings.ts",
    "src/utils/sessionAlertLogic.ts",
    "vite.config.ts"
  ]
}
```

이로 인해 electron 빌드 결과는 `dist-electron/electron/*.js`와 `dist-electron/src/types/settings.js`, `dist-electron/src/utils/sessionAlertLogic.js`로 함께 출력된다. main process가 `../src/types/settings`로 import하면 정상 해석된다.

`package.json`의 `main` 경로(`dist-electron/electron/main.js`)는 그대로 둔다.

- [ ] **Step 1: configStore.ts 작성**

`electron/configStore.ts`:

```ts
import fs from "fs";
import os from "os";
import path from "path";
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from "../src/types/settings";

const SETTINGS_DIR = path.join(os.homedir(), ".claude-pulse");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");
const BACKUP_PATH = path.join(SETTINGS_DIR, "settings.json.bak");

type Listener = (settings: AppSettings) => void;

let current: AppSettings = DEFAULT_SETTINGS;
const listeners = new Set<Listener>();

function ensureDir(): void {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

function writeAtomic(data: AppSettings): void {
  ensureDir();
  const tmp = `${SETTINGS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, SETTINGS_PATH);
}

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      writeAtomic(DEFAULT_SETTINGS);
      current = DEFAULT_SETTINGS;
      return current;
    }
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    current = mergeSettings(parsed, DEFAULT_SETTINGS);
    return current;
  } catch (err) {
    console.error("[configStore] load failed, falling back to defaults:", err);
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        fs.copyFileSync(SETTINGS_PATH, BACKUP_PATH);
      }
    } catch {
      // ignore backup failure
    }
    current = DEFAULT_SETTINGS;
    writeAtomic(current);
    return current;
  }
}

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  current = mergeSettings(partial, current);
  writeAtomic(current);
  for (const listener of listeners) listener(current);
  return current;
}

export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

- [ ] **Step 2: main.ts에서 startup 시 loadSettings 호출**

`electron/main.ts` 수정 — `app.whenReady().then(...)` 안에서 createMainWindow 전에 추가:

```ts
import { loadSettings } from "./configStore";

// ...

app.whenReady().then(() => {
  loadSettings();
  createMainWindow();
  createTray();
  startSessionsMonitor();
});
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run build
```

Expected: success, no TS errors. `dist-electron/src/types/settings.js`가 생성됨을 확인:

```bash
ls dist-electron/src/types/settings.js
```

- [ ] **Step 4: 수동 검증**

```bash
npm run dev
```

앱이 켜지면 다른 터미널에서:

```bash
ls -la ~/.claude-pulse/ && cat ~/.claude-pulse/settings.json
```

Expected: `~/.claude-pulse/settings.json`이 존재하고 DEFAULT_SETTINGS가 들어 있음. 앱 닫기.

- [ ] **Step 5: 커밋**

```bash
git add tsconfig.node.json electron/configStore.ts electron/main.ts
git commit -m "feat(settings): add configStore for settings.json persistence"
```

---

### Task 3: IPC 채널 + preload + ElectronAPI 타입

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/stats.ts`

- [ ] **Step 1: main.ts에 IPC 핸들러 추가**

`electron/main.ts`의 기존 `ipcMain.handle("get-stats-data", ...)` 근처에 추가:

```ts
import { loadSettings, getSettings, updateSettings, onSettingsChange } from "./configStore";
import type { AppSettings } from "../src/types/settings";

ipcMain.handle("get-settings", () => getSettings());

ipcMain.handle("update-settings", (_event, partial: Partial<AppSettings>) => {
  return updateSettings(partial);
});
```

그리고 `app.whenReady` 안에 settings 변경 브로드캐스트 등록:

```ts
app.whenReady().then(() => {
  loadSettings();
  onSettingsChange((settings) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("settings-updated", settings);
    }
  });
  createMainWindow();
  createTray();
  startSessionsMonitor();
});
```

- [ ] **Step 2: preload.ts에 API 노출**

`electron/preload.ts`의 `contextBridge.exposeInMainWorld("electronAPI", { ... })` 안에 추가:

```ts
getSettings: () => ipcRenderer.invoke("get-settings"),
updateSettings: (partial: unknown) => ipcRenderer.invoke("update-settings", partial),
onSettingsUpdated: (callback: (data: unknown) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
  ipcRenderer.on("settings-updated", handler);
  return () => {
    ipcRenderer.removeListener("settings-updated", handler);
  };
},
```

- [ ] **Step 3: src/types/stats.ts에 ElectronAPI 메서드 추가**

기존 `ElectronAPI` 인터페이스 안에 추가:

```ts
import type { AppSettings } from "./settings";

// ...

  getSettings: () => Promise<AppSettings>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void;
```

- [ ] **Step 4: 빌드 통과 확인**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: 커밋**

```bash
git add electron/main.ts electron/preload.ts src/types/stats.ts
git commit -m "feat(settings): expose settings IPC channels"
```

---

### Task 4: useSettings hook

**Files:**
- Create: `src/hooks/useSettings.ts`

- [ ] **Step 1: useSettings 작성**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";

const QUERY_KEY = ["settings"] as const;

export function useSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => window.electronAPI.getSettings(),
    staleTime: Infinity,
  });

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSettingsUpdated((next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    });
    return unsubscribe;
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: (partial: Partial<AppSettings>) =>
      window.electronAPI.updateSettings(partial),
    onSuccess: (next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    },
  });

  return {
    settings: data ?? DEFAULT_SETTINGS,
    loading: isLoading,
    update: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/useSettings.ts
git commit -m "feat(settings): add useSettings hook"
```

---

### Task 5: SettingsTab 컴포넌트

**Files:**
- Create: `src/components/SettingsTab.tsx`

- [ ] **Step 1: SettingsTab 작성**

```tsx
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
    <label
      className={`flex items-center justify-between py-2 ${
        disabled ? "opacity-50" : ""
      }`}
    >
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
          {savedFlash && (
            <span className="text-xs text-(--text-secondary)">✓ 저장됨</span>
          )}
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
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: 커밋**

```bash
git add src/components/SettingsTab.tsx
git commit -m "feat(settings): add SettingsTab component"
```

---

### Task 6: TabBar에 "설정" 탭 추가 + App 렌더링

**Files:**
- Modify: `src/components/TabBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: TabBar의 TabType + TABS 확장**

`src/components/TabBar.tsx`의 첫 줄과 TABS 배열을 수정:

```ts
export type TabType = "stats" | "projects" | "settings";

const TABS: { key: TabType; label: string }[] = [
  { key: "stats", label: "사용량 분석" },
  { key: "projects", label: "프로젝트 활동" },
  { key: "settings", label: "설정" },
];
```

- [ ] **Step 2: App.tsx에 SettingsTab import + 렌더 분기 추가**

import 추가:

```tsx
import { SettingsTab } from "./components/SettingsTab";
```

기존 `activeTab === "projects"` 분기들 아래에 추가:

```tsx
{activeTab === "settings" && <SettingsTab />}
```

- [ ] **Step 3: 빌드 + 린트 통과**

```bash
npm run build && npm run lint
```

Expected: success, 0 errors/warnings.

- [ ] **Step 4: 수동 검증**

```bash
npm run dev
```

- "설정" 탭 클릭 → 알림 섹션 보임
- "알림 사용" off → 하위 옵션이 회색
- "정체 임계 시간"을 5로 변경 → 다른 터미널에서 `cat ~/.claude-pulse/settings.json` 확인 → `stuckThresholdMinutes: 5`
- 앱 종료 후 재시작 → 변경사항 유지

- [ ] **Step 5: 커밋**

```bash
git add src/components/TabBar.tsx src/App.tsx
git commit -m "feat(settings): add settings tab to main window"
```

---

## Stage 2: SessionAlertMonitor (Tasks 7–8)

### Task 7: sessionAlertLogic 순수 함수 (TDD)

**Files:**
- Create: `src/utils/sessionAlertLogic.ts`
- Create: `src/__tests__/sessionAlertLogic.test.ts`

이 task는 logic의 모든 분기를 테스트로 고정한다. Notification이나 timer 없이 pure function으로.

- [ ] **Step 1: 실패하는 테스트 작성 (등록 + 첫 폴링)**

`src/__tests__/sessionAlertLogic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";
import {
  evaluate,
  type SessionInput,
  type SessionTrackState,
} from "../utils/sessionAlertLogic";

const settings: AppSettings = DEFAULT_SETTINGS;
const T0 = 1_700_000_000_000;

function session(id: string, isActive: boolean, projectName = "demo"): SessionInput {
  return { sessionId: id, isActive, projectName };
}

describe("evaluate — registration", () => {
  it("registers a new active session and starts activeSince", () => {
    const result = evaluate(new Map(), [session("s1", true)], settings, T0);
    expect(result.alerts).toEqual([]);
    expect(result.newState.get("s1")).toMatchObject({
      sessionId: "s1",
      lastStatus: "active",
      activeSince: T0,
      lastStuckAlertAt: null,
      hasFiredCompletionAlert: false,
    });
  });

  it("registers a new idle session with hasFiredCompletionAlert=true (suppress false-positive)", () => {
    const result = evaluate(new Map(), [session("s1", false)], settings, T0);
    expect(result.alerts).toEqual([]);
    expect(result.newState.get("s1")).toMatchObject({
      lastStatus: "idle",
      activeSince: null,
      hasFiredCompletionAlert: true,
    });
  });

  it("removes sessions that disappeared", () => {
    const prev = new Map<string, SessionTrackState>([
      [
        "s1",
        {
          sessionId: "s1",
          lastStatus: "active",
          activeSince: T0,
          lastStuckAlertAt: null,
          hasFiredCompletionAlert: false,
        },
      ],
    ]);
    const result = evaluate(prev, [], settings, T0 + 1000);
    expect(result.newState.has("s1")).toBe(false);
    expect(result.alerts).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- sessionAlertLogic
```

Expected: FAIL — module not found.

- [ ] **Step 3: 최소 구현**

`src/utils/sessionAlertLogic.ts`:

```ts
import type { AppSettings } from "../types/settings";

export interface SessionInput {
  sessionId: string;
  isActive: boolean;
  projectName: string;
}

export interface SessionTrackState {
  sessionId: string;
  lastStatus: "active" | "idle";
  activeSince: number | null;
  lastStuckAlertAt: number | null;
  hasFiredCompletionAlert: boolean;
}

export type Alert =
  | { type: "completion"; sessionId: string; projectName: string }
  | {
      type: "stuck";
      sessionId: string;
      projectName: string;
      activeMinutes: number;
    };

export interface EvaluateResult {
  newState: Map<string, SessionTrackState>;
  alerts: Alert[];
}

export function evaluate(
  prevState: Map<string, SessionTrackState>,
  current: SessionInput[],
  settings: AppSettings,
  now: number
): EvaluateResult {
  const newState = new Map<string, SessionTrackState>();
  const alerts: Alert[] = [];
  const currentIds = new Set(current.map((s) => s.sessionId));

  for (const s of current) {
    const existing = prevState.get(s.sessionId);

    if (!existing) {
      newState.set(s.sessionId, {
        sessionId: s.sessionId,
        lastStatus: s.isActive ? "active" : "idle",
        activeSince: s.isActive ? now : null,
        lastStuckAlertAt: null,
        hasFiredCompletionAlert: !s.isActive,
      });
      continue;
    }

    let next: SessionTrackState = { ...existing };

    if (existing.lastStatus === "active" && !s.isActive) {
      // ⚡ → 💤
      if (!existing.hasFiredCompletionAlert && settings.notifications.completionAlert) {
        alerts.push({
          type: "completion",
          sessionId: s.sessionId,
          projectName: s.projectName,
        });
      }
      next.lastStatus = "idle";
      next.activeSince = null;
      next.lastStuckAlertAt = null;
      next.hasFiredCompletionAlert = true;
    } else if (existing.lastStatus === "idle" && s.isActive) {
      // 💤 → ⚡
      next.lastStatus = "active";
      next.activeSince = now;
      next.lastStuckAlertAt = null;
      next.hasFiredCompletionAlert = false;
    } else if (s.isActive) {
      // still active — check stuck threshold
      const since = next.activeSince ?? now;
      next.activeSince = since;
      if (settings.notifications.stuckAlert) {
        const elapsedMs = now - since;
        const thresholdMs = settings.notifications.stuckThresholdMinutes * 60_000;
        const repeatMs = settings.notifications.stuckRepeatMinutes * 60_000;
        if (elapsedMs >= thresholdMs) {
          const since2 = next.lastStuckAlertAt;
          const shouldFire =
            since2 === null ? true : now - since2 >= repeatMs;
          if (shouldFire) {
            alerts.push({
              type: "stuck",
              sessionId: s.sessionId,
              projectName: s.projectName,
              activeMinutes: Math.floor(elapsedMs / 60_000),
            });
            next.lastStuckAlertAt = now;
          }
        }
      }
    }

    newState.set(s.sessionId, next);
  }

  // sessions that disappeared are simply not added to newState
  void currentIds;
  return { newState, alerts };
}
```

- [ ] **Step 4: 첫 3개 테스트 통과 확인**

```bash
npm test -- sessionAlertLogic
```

Expected: PASS (3 tests)

- [ ] **Step 5: ⚡→💤 전환 + 정체 알림 테스트 추가**

`src/__tests__/sessionAlertLogic.test.ts`에 다음 describe를 추가:

```ts
describe("evaluate — completion alert (⚡→💤)", () => {
  function activeState(id: string, since: number): SessionTrackState {
    return {
      sessionId: id,
      lastStatus: "active",
      activeSince: since,
      lastStuckAlertAt: null,
      hasFiredCompletionAlert: false,
    };
  }

  it("fires completion alert when active session becomes idle", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const result = evaluate(prev, [session("s1", false)], settings, T0 + 5000);
    expect(result.alerts).toEqual([
      { type: "completion", sessionId: "s1", projectName: "demo" },
    ]);
    expect(result.newState.get("s1")).toMatchObject({
      lastStatus: "idle",
      activeSince: null,
      hasFiredCompletionAlert: true,
    });
  });

  it("does not fire completion alert twice in same idle cycle", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const r1 = evaluate(prev, [session("s1", false)], settings, T0 + 5000);
    const r2 = evaluate(r1.newState, [session("s1", false)], settings, T0 + 10000);
    expect(r2.alerts).toEqual([]);
  });

  it("re-arms completion alert after 💤→⚡→💤 cycle", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const r1 = evaluate(prev, [session("s1", false)], settings, T0 + 5000);
    const r2 = evaluate(r1.newState, [session("s1", true)], settings, T0 + 10000);
    const r3 = evaluate(r2.newState, [session("s1", false)], settings, T0 + 15000);
    expect(r3.alerts).toEqual([
      { type: "completion", sessionId: "s1", projectName: "demo" },
    ]);
  });

  it("does not fire completion alert when completionAlert setting is off", () => {
    const off: AppSettings = {
      notifications: { ...settings.notifications, completionAlert: false },
    };
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const result = evaluate(prev, [session("s1", false)], off, T0 + 5000);
    expect(result.alerts).toEqual([]);
  });
});

describe("evaluate — stuck alert", () => {
  function activeState(id: string, since: number): SessionTrackState {
    return {
      sessionId: id,
      lastStatus: "active",
      activeSince: since,
      lastStuckAlertAt: null,
      hasFiredCompletionAlert: false,
    };
  }

  it("fires stuck alert when active duration exceeds threshold", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const result = evaluate(prev, [session("s1", true)], settings, eleven);
    expect(result.alerts).toEqual([
      { type: "stuck", sessionId: "s1", projectName: "demo", activeMinutes: 11 },
    ]);
    expect(result.newState.get("s1")?.lastStuckAlertAt).toBe(eleven);
  });

  it("does not refire stuck alert before repeat interval", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const r1 = evaluate(prev, [session("s1", true)], settings, eleven);
    const fifteen = T0 + 15 * 60_000;
    const r2 = evaluate(r1.newState, [session("s1", true)], settings, fifteen);
    expect(r2.alerts).toEqual([]);
  });

  it("refires stuck alert after repeat interval elapsed", () => {
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const r1 = evaluate(prev, [session("s1", true)], settings, eleven);
    const fortyTwo = T0 + 42 * 60_000;
    const r2 = evaluate(r1.newState, [session("s1", true)], settings, fortyTwo);
    expect(r2.alerts).toEqual([
      { type: "stuck", sessionId: "s1", projectName: "demo", activeMinutes: 42 },
    ]);
  });

  it("does not fire stuck alert when stuckAlert setting is off", () => {
    const off: AppSettings = {
      notifications: { ...settings.notifications, stuckAlert: false },
    };
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const eleven = T0 + 11 * 60_000;
    const result = evaluate(prev, [session("s1", true)], off, eleven);
    expect(result.alerts).toEqual([]);
  });

  it("respects custom stuckThresholdMinutes from settings", () => {
    const custom: AppSettings = {
      notifications: { ...settings.notifications, stuckThresholdMinutes: 1 },
    };
    const prev = new Map([["s1", activeState("s1", T0)]]);
    const result = evaluate(prev, [session("s1", true)], custom, T0 + 90_000);
    expect(result.alerts).toHaveLength(1);
  });
});
```

- [ ] **Step 6: 모든 테스트 통과 확인**

```bash
npm test -- sessionAlertLogic
```

Expected: PASS (12 tests total: 3 registration + 4 completion + 5 stuck)

- [ ] **Step 7: 커밋**

```bash
git add src/utils/sessionAlertLogic.ts src/__tests__/sessionAlertLogic.test.ts
git commit -m "feat(alerts): add sessionAlertLogic pure step function with tests"
```

---

### Task 8: sessionAlertMonitor wrapper + main.ts 통합

**Files:**
- Create: `electron/sessionAlertMonitor.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: sessionAlertMonitor.ts 작성**

```ts
import { Notification } from "electron";
import {
  evaluate,
  type Alert,
  type SessionInput,
  type SessionTrackState,
} from "../src/utils/sessionAlertLogic";
import type { AppSettings } from "../src/types/settings";

let state = new Map<string, SessionTrackState>();
let onClickHandler: (() => void) | null = null;

export function setAlertClickHandler(fn: () => void): void {
  onClickHandler = fn;
}

interface ProcessOptions {
  sessions: SessionInput[];
  settings: AppSettings;
  now?: number;
}

export interface ProcessResult {
  hasStuckSessions: boolean;
}

export function processSessions({ sessions, settings, now = Date.now() }: ProcessOptions): ProcessResult {
  const result = evaluate(state, sessions, settings, now);
  state = result.newState;

  if (settings.notifications.enabled) {
    for (const alert of result.alerts) {
      dispatchNotification(alert, settings);
    }
  }

  let hasStuckSessions = false;
  for (const tracked of state.values()) {
    if (tracked.lastStuckAlertAt !== null) {
      hasStuckSessions = true;
      break;
    }
  }
  return { hasStuckSessions };
}

function dispatchNotification(alert: Alert, settings: AppSettings): void {
  if (!Notification.isSupported()) return;

  let title: string;
  let body: string;
  let silent: boolean;

  if (alert.type === "completion") {
    title = "작업 완료";
    body = `${alert.projectName} 작업이 완료되었습니다`;
    silent = true;
  } else {
    title = "세션 정체";
    body = `${alert.projectName} 세션이 ${alert.activeMinutes}분째 작업 중입니다`;
    silent = !settings.notifications.sound;
  }

  const n = new Notification({ title, body, silent });
  n.on("click", () => {
    if (onClickHandler) onClickHandler();
  });
  n.show();
}

export function resetAlertState(): void {
  state = new Map();
}
```

- [ ] **Step 2: main.ts에서 sessionAlertMonitor 호출**

`electron/main.ts`의 import 추가:

```ts
import { processSessions, setAlertClickHandler } from "./sessionAlertMonitor";
```

`broadcastSessions` 함수를 수정해 processSessions를 호출:

```ts
function broadcastSessions(): void {
  const sessions = readSessions();
  processSessions({
    sessions: sessions.map((s) => ({
      sessionId: s.sessionId,
      isActive: s.isActive,
      projectName: s.projectName,
    })),
    settings: getSettings(),
  });
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.webContents.send("sessions-updated", sessions);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("sessions-updated", sessions);
  }
}
```

`app.whenReady` 안에 click handler 등록을 추가 (createTray 호출 후):

```ts
app.whenReady().then(() => {
  loadSettings();
  onSettingsChange((settings) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("settings-updated", settings);
    }
  });
  createMainWindow();
  createTray();
  setAlertClickHandler(() => togglePopover());
  startSessionsMonitor();
});
```

- [ ] **Step 3: 빌드 + 테스트 통과 확인**

```bash
npm run build && npm test
```

Expected: success, all tests pass.

- [ ] **Step 4: 수동 검증**

`npm run dev` 후 설정 탭에서 임계 시간을 1분으로 낮춤. 그다음:

```bash
mkdir -p ~/.claude/sessions && cat > ~/.claude/sessions/99999.json <<'EOF'
{"pid": 1, "sessionId": "test-stuck", "cwd": "/Users/yjlee/Documents/code/test", "startedAt": 1700000000000, "name": "stuck demo"}
EOF
```

(PID 1은 launchd, 항상 살아있고 CPU > 1%일 가능성 낮음 — 필요시 `top`으로 살아있는 다른 PID로 대체)

1분 후 macOS 알림 센터에 정체 알림 표시 확인. 그다음:

```bash
rm ~/.claude/sessions/99999.json
```

5초 안에 세션 사라지고 popover에서 빠짐 (정체 후 사라진 케이스라 작업 완료 알림은 안 뜸 — 정상). 

작업 완료 시나리오는 더 까다로움: PID를 실제 활성 프로세스로 잡고 있다가 다른 프로세스로 바꾸면 `getCpuPercent`가 변함. 기능 검증은 단위 테스트로 충분히 커버됨.

- [ ] **Step 5: 커밋**

```bash
git add electron/sessionAlertMonitor.ts electron/main.ts
git commit -m "feat(alerts): integrate session alert monitor with main process"
```

---

## Stage 3: Tray badge + popover ⚙️ + tab control (Tasks 9–11)

### Task 9: 트레이 알림 아이콘 + setImage 토글

**Files:**
- Create: `build/iconTemplateAlert.png`, `build/iconTemplateAlert@2x.png`
- Modify: `electron/main.ts`

- [ ] **Step 1: 알림 아이콘 생성 (Pillow로 기존 + 빨간 점)**

```bash
python3 -c "
from PIL import Image, ImageDraw
for size in (16, 32):
    name = 'iconTemplate.png' if size == 16 else 'iconTemplate@2x.png'
    out_name = 'iconTemplateAlert.png' if size == 16 else 'iconTemplateAlert@2x.png'
    img = Image.open(f'build/{name}').convert('RGBA')
    d = ImageDraw.Draw(img)
    r = max(2, size // 5)
    x1 = size - r * 2
    y1 = 0
    x2 = size
    y2 = r * 2
    # template image: only black + alpha. Make a black filled circle (badge dot).
    d.ellipse([x1, y1, x2, y2], fill=(0, 0, 0, 255))
    img.save(f'build/{out_name}')
print('done')
"
ls -la build/iconTemplateAlert*
```

Expected: 두 파일 생성됨.

- [ ] **Step 2: main.ts에 아이콘 경로 + 토글 함수 추가**

`electron/main.ts`의 `createTray` 근처에 헬퍼 추가:

```ts
function getTrayIconPath(alert: boolean): string {
  const filename = alert ? "iconTemplateAlert.png" : "iconTemplate.png";
  return isDev
    ? path.join(__dirname, "../../build", filename)
    : path.join(process.resourcesPath, "build", filename);
}

let trayIsAlert = false;

function setTrayAlert(alert: boolean): void {
  if (!tray || trayIsAlert === alert) return;
  const image = nativeImage.createFromPath(getTrayIconPath(alert));
  if (!image.isEmpty()) image.setTemplateImage(true);
  tray.setImage(image);
  trayIsAlert = alert;
}
```

`createTray` 안의 기존 `iconPath` 부분을 헬퍼 사용으로 교체:

```ts
function createTray(): void {
  const image = nativeImage.createFromPath(getTrayIconPath(false));
  if (!image.isEmpty()) image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip("Claude Analysis");
  tray.on("click", () => togglePopover());
  tray.on("right-click", () => togglePopover());
}
```

`broadcastSessions`에서 processSessions 결과로 트레이 갱신:

```ts
function broadcastSessions(): void {
  const sessions = readSessions();
  const { hasStuckSessions } = processSessions({
    sessions: sessions.map((s) => ({
      sessionId: s.sessionId,
      isActive: s.isActive,
      projectName: s.projectName,
    })),
    settings: getSettings(),
  });
  if (getSettings().notifications.enabled) {
    setTrayAlert(hasStuckSessions);
  } else {
    setTrayAlert(false);
  }
  // ... 기존 webContents.send 호출들
}
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: 수동 검증**

`npm run dev` → 설정 탭에서 임계 시간 1분으로 → 더미 세션 파일로 정체 유발 → 1분 후 트레이 아이콘에 점 표시 → `rm` 후 점 사라짐.

- [ ] **Step 5: 커밋**

```bash
git add build/iconTemplateAlert.png build/iconTemplateAlert@2x.png electron/main.ts
git commit -m "feat(alerts): add tray badge for stuck sessions"
```

---

### Task 10: show-main-window-tab IPC + App 외부 탭 제어

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/stats.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: main.ts에 IPC 핸들러**

`electron/main.ts`의 ipcMain 섹션에 추가. (참고: `TabType`은 `src/components/TabBar.tsx`에서만 정의되지만, 그 파일은 React TSX라 electron tsc가 컴파일할 수 없다. main 쪽에서는 동일한 리터럴 union을 직접 선언해 사용한다.)

```ts
type TabPayload = "stats" | "projects" | "settings";

ipcMain.on("show-main-window-tab", (_event, tab: TabPayload) => {
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  // wait until window is ready before sending tab
  const send = () => {
    mainWindow?.webContents.send("set-active-tab", tab);
  };
  if (mainWindow?.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", send);
  } else {
    send();
  }
  if (popoverWindow?.isVisible()) popoverWindow.hide();
});
```

(기존 `show-main-window` 핸들러는 그대로 둠 — popover 홈 버튼은 탭 지정 없이 동작)

- [ ] **Step 2: preload.ts에 API**

```ts
showMainWindowTab: (tab: string) => ipcRenderer.send("show-main-window-tab", tab),
onSetActiveTab: (callback: (tab: string) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, tab: string) => callback(tab);
  ipcRenderer.on("set-active-tab", handler);
  return () => {
    ipcRenderer.removeListener("set-active-tab", handler);
  };
},
```

- [ ] **Step 3: ElectronAPI 타입 추가**

`src/types/stats.ts`의 `ElectronAPI` 인터페이스에:

```ts
import type { TabType } from "../components/TabBar";

  showMainWindowTab: (tab: TabType) => void;
  onSetActiveTab: (callback: (tab: TabType) => void) => () => void;
```

- [ ] **Step 4: App.tsx에서 set-active-tab 수신**

`src/App.tsx`의 `useState` 아래에 `useEffect` 추가:

```tsx
import { useEffect, useState } from "react";

// 기존 const [activeTab, setActiveTab] = useState<TabType>("stats"); 아래

useEffect(() => {
  const unsubscribe = window.electronAPI.onSetActiveTab((tab) => {
    setActiveTab(tab);
  });
  return unsubscribe;
}, []);
```

- [ ] **Step 5: 빌드 + 린트 통과**

```bash
npm run build && npm run lint
```

Expected: success, 0 errors/warnings.

- [ ] **Step 6: 커밋**

```bash
git add electron/main.ts electron/preload.ts src/types/stats.ts src/App.tsx
git commit -m "feat(settings): add show-main-window-tab IPC for external tab control"
```

---

### Task 11: PopoverApp ⚙️ 버튼

**Files:**
- Modify: `src/components/PopoverApp.tsx`

- [ ] **Step 1: 헤더의 홈 버튼 옆에 ⚙️ 버튼 추가**

`src/components/PopoverApp.tsx`의 `<header>` 안 홈 버튼 마크업을 다음으로 교체 (홈 버튼 유지 + 새 ⚙️ 버튼 추가, 둘을 flex gap으로 묶음):

```tsx
<div className="flex items-center gap-1">
  <button
    type="button"
    onClick={() => window.electronAPI.showMainWindowTab("settings")}
    className="w-7 h-7 flex items-center justify-center rounded hover:bg-(--badge-bg) cursor-pointer transition-colors"
    title="설정"
    aria-label="설정"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </button>
  <button
    type="button"
    onClick={() => window.electronAPI.showMainWindow()}
    className="w-7 h-7 flex items-center justify-center rounded hover:bg-(--badge-bg) cursor-pointer transition-colors"
    title="메인 창 열기"
    aria-label="메인 창 열기"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  </button>
</div>
```

- [ ] **Step 2: 빌드 + 린트 + 테스트 전체 통과**

```bash
npm run build && npm run lint && npm test
```

Expected: success, 0 errors, all tests pass (49 + 5 settings + 12 sessionAlertLogic = 66).

- [ ] **Step 3: 수동 검증 (전체 시나리오)**

```bash
npm run dev
```

1. 메인 창 → "설정" 탭 보임 → 알림 토글/임계값 조정 → `~/.claude-pulse/settings.json` 즉시 갱신
2. 트레이 클릭 → 팝오버 → 헤더에 ⚙️ + 🏠 두 버튼
3. ⚙️ 클릭 → 메인 창 + 설정 탭 활성화
4. 🏠 클릭 → 메인 창 (탭은 마지막 활성)
5. 설정 탭에서 임계 시간 1분 → 더미 세션 파일로 정체 유발 → macOS 알림 + 트레이 아이콘 점 표시
6. 더미 세션 제거 → 트레이 점 사라짐
7. 알림 클릭 → 팝오버 토글
8. 마스터 토글 OFF → 정체 알림 안 뜸 + 트레이 점 표시 안 됨

- [ ] **Step 4: 커밋**

```bash
git add src/components/PopoverApp.tsx
git commit -m "feat(settings): add settings gear button to popover header"
```

---

## 검증 요약

각 task 완료 후 자동으로 다음을 통과해야 한다:

| 명령 | 기대 |
|------|------|
| `npm test` | 49 + 5(settings) + 12(sessionAlertLogic) = 66 tests pass |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run build` | 성공 |

수동 검증은 Stage 3 마지막 task의 시나리오가 전부 통과하면 종료.
