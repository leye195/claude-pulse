# 세션 알림 시스템

## Context

Claude Pulse는 현재 트레이 팝오버에서 활성 세션을 ⚡(작업 중) / 💤(대기 중) 상태로 보여주지만, 사용자가 직접 확인해야만 알 수 있다. 긴 작업을 돌려놓고 다른 일을 하다가 작업이 끝났는지, 또는 비정상적으로 오래 ⚡ 상태에 머물러 있는지 알아채기 어렵다.

이 작업은 두 가지 알림을 추가한다:

1. **작업 완료 알림** — 활성 세션이 ⚡→💤로 전환될 때
2. **세션 정체 경고** — ⚡ 상태가 임계 시간(기본 10분) 이상 지속될 때 + 30분 간격 재알림

알림은 macOS 시스템 알림(Notification Center) + 트레이 아이콘 뱃지 변경의 두 채널로 전달된다. 사용자는 새 "설정" 탭에서 알림을 토글하고 임계값을 조정할 수 있다.

## 요구사항

- 작업 완료 알림: ⚡→💤 전환 시 1회, 같은 사이클에 중복 X
- 정체 알림: 임계 시간 초과 시 1회 + 재알림 간격(기본 30분)마다 재발사
- 앱 시작 직후 이미 💤인 세션은 알림 X (false-positive 방지)
- 알림 클릭 시 트레이 팝오버 토글 (메인 창 X, 가벼운 액세스)
- 트레이 아이콘: 정체 세션 1개 이상이면 점 표시 변형, 해소 시 복귀
- 사용자 설정: 마스터 토글, 작업 완료/정체 개별 토글, 임계 시간, 재알림 간격, 사운드
- 설정은 영속화되어야 함 (`~/.claude-pulse/settings.json`)
- 메인 창과 팝오버에 설정 변경 즉시 반영 (IPC 브로드캐스트)
- 팝오버 헤더에 ⚙️ 버튼 → 클릭 시 메인 창 열기 + 설정 탭 활성

## 아키텍처

```
electron/main.ts
  ├── 5초 폴링 (기존 readSessions)
  ├── SessionAlertMonitor (신규)
  │     ├── 직전 스냅샷과 비교 → ⚡↔💤 전환 감지
  │     ├── ⚡ 지속 시간 추적 → 임계값 초과 시 정체 알림
  │     └── 알림 발사 + 재알림 타이머
  ├── Notification API (electron 내장) → macOS Notification Center
  ├── tray.setImage() → 활성 알림 있을 때 점이 찍힌 변형
  └── ConfigStore (신규, ~/.claude-pulse/settings.json)
        └── 메인↔렌더러 IPC로 읽기/쓰기 + 변경 브로드캐스트

src/
  ├── components/SettingsTab.tsx (신규) — 알림 토글, 임계값, 사운드
  ├── components/PopoverApp.tsx — ⚙️ 버튼 추가
  ├── components/TabBar.tsx — "설정" 탭 추가
  ├── App.tsx — TabType 확장 + IPC 외부 제어
  ├── hooks/useSettings.ts (신규)
  └── types/settings.ts (신규)
```

## SessionAlertMonitor

### 상태 (메모리, 앱 재시작 시 초기화)

```ts
interface SessionTrackState {
  sessionId: string;
  lastStatus: "active" | "idle";        // ⚡ or 💤
  activeSince: number | null;            // ⚡ 진입 시각 (ms)
  lastStuckAlertAt: number | null;       // 마지막 정체 알림 시각
  hasFiredCompletionAlert: boolean;      // 이번 active→idle 사이클 알림 여부
}

const tracked = new Map<string, SessionTrackState>();
```

### 5초 폴링마다 (`broadcastSessions` 안에서 호출)

1. **새 세션 등록** → `tracked`에 추가
   - 초기 상태가 `idle`이면 `hasFiredCompletionAlert = true`로 세팅 (앱 시작 시 이미 💤인 세션의 false-positive 방지)
   - 초기 상태가 `active`면 `activeSince = now`로 세팅 (앱 시작 후 새로 발견된 활성 세션은 임계값 카운트를 이 시점부터 시작 — 실제 세션 시작 시각이 아님에 유의)
2. 사라진 세션 → `tracked`에서 제거
3. 각 세션 diff:
   - **⚡→💤 전환**: `hasFiredCompletionAlert == false`이면 작업 완료 알림 발사 + `true`로 세팅, `activeSince = null`
   - **⚡ 지속 ≥ 임계값** (현재 status가 `active`이고 `now - activeSince >= threshold`):
     - `lastStuckAlertAt` 없음 → 정체 알림 발사 + `lastStuckAlertAt = now`
     - 있음 + `now - lastStuckAlertAt >= 재알림 간격` → 재발사 + 시각 갱신
   - **💤→⚡ 전환**: `activeSince = now`, `lastStuckAlertAt = null`, `hasFiredCompletionAlert = false`

### 알림 발사

- `new Notification({ title, body, silent })` (electron 내장 API)
- **작업 완료**: `silent: true`, body = `{프로젝트명} 작업이 완료되었습니다`
- **정체**: `silent: !settings.notifications.sound`, body = `{프로젝트명} 세션이 {N}분째 작업 중입니다`
- 클릭 시 → 트레이 팝오버 토글 (`togglePopover()`)

### 트레이 뱃지

- 정체 세션 ≥ 1 → `iconTemplateAlert.png` (점이 추가된 변형)
- 모두 해소 → 기본 `iconTemplate.png` 복귀
- 변경은 `broadcastSessions` 끝에서 idempotent하게 호출

### 엣지 케이스

- 알림 마스터 토글 OFF → monitor의 상태 추적은 계속되지만 `Notification` 발사 + 트레이 뱃지 토글 스킵
- 임계값 하향 시 → `lastStuckAlertAt` 유지. 다음 폴링에서 자연스럽게 평가됨 (현재 active 시간이 새 임계값 초과 + `lastStuckAlertAt`이 null이면 즉시 발사)
- 임계값 상향 시 → 동일하게 다음 폴링에서 평가, 자연스럽게 알림이 늦춰짐
- 같은 PID 재사용 가능성 낮으므로 `sessionId` 기준 추적
- `Notification.isSupported()` false인 환경 → 시스템 알림 발사 스킵, 트레이 뱃지만 동작

## 설정

### `AppSettings` 스키마

```ts
interface AppSettings {
  notifications: {
    enabled: boolean;              // 마스터 토글, 기본 true
    completionAlert: boolean;      // ⚡→💤 알림, 기본 true
    stuckAlert: boolean;           // 정체 알림, 기본 true
    stuckThresholdMinutes: number; // 기본 10
    stuckRepeatMinutes: number;    // 기본 30
    sound: boolean;                // 정체 알림 사운드, 기본 true
  };
}
```

### ConfigStore (main process)

- `loadSettings()` — 파일 없으면 기본값으로 생성, JSON 손상 시 기본값 fallback + `.bak`로 백업 보존
- `saveSettings(partial)` — deep merge 후 atomic write (`tmp` → rename)
- `onChange(callback)` — `SessionAlertMonitor`가 임계값 변경 즉시 반영
- 파일 위치: `path.join(os.homedir(), ".claude-pulse", "settings.json")`

### IPC 채널

| 채널 | 방향 | 용도 |
|------|------|------|
| `get-settings` | invoke (renderer→main) | 초기 로드 |
| `update-settings` | invoke (renderer→main) | partial update, 성공 시 새 settings 반환 |
| `settings-updated` | push (main→renderers) | 다른 윈도우 동기화 |
| `show-main-window-tab` | send (renderer→main) | 페이로드: `TabType` (`"stats" \| "projects" \| "settings"`). 메인 창 열기 + 활성 탭 전환을 위해 main이 `set-active-tab` push로 메인 윈도우에 전달 |
| `set-active-tab` | push (main→main window) | 메인 창의 `App`이 수신해 `activeTab` state 갱신 |

### `useSettings` 훅 (renderer)

- TanStack Query (`get-settings`)
- `useMutation`으로 update → 성공 시 main이 `settings-updated` push → 모든 윈도우 cache 갱신
- 메인 창과 팝오버 양쪽에서 호출 가능

### SettingsTab UI

```
┌──────────────────────────────────────────────┐
│  설정                                          │
├──────────────────────────────────────────────┤
│  알림                                          │
│  ┌────────────────────────────────────────┐  │
│  │ □ 알림 사용                              │  │
│  │   ─────────────────                      │  │
│  │   □ 작업 완료 알림 (⚡→💤)               │  │
│  │   □ 세션 정체 경고                       │  │
│  │     임계 시간:  [10] 분                  │  │
│  │     재알림 간격: [30] 분                 │  │
│  │     □ 사운드                             │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

- 마스터 토글 OFF면 하위 옵션 disabled (회색)
- 입력 변경 즉시 저장 (debounce 500ms)
- 저장 성공 시 작은 "✓ 저장됨" 표시 0.8초

### 팝오버 ⚙️ 버튼

- 헤더 홈 버튼 옆에 ⚙️ 추가
- 클릭 → IPC `show-main-window-tab("settings")` → 메인 창 열기 + 활성 탭을 settings로

## 파일 변경 목록

### 신규 파일

| 파일 | 용도 |
|------|------|
| `electron/sessionAlertMonitor.ts` | 세션 상태 diff + 알림 발사 + 재알림 타이머 |
| `electron/configStore.ts` | settings.json 로드/저장/onChange |
| `src/components/SettingsTab.tsx` | 설정 UI |
| `src/hooks/useSettings.ts` | TanStack Query 기반 설정 훅 |
| `src/types/settings.ts` | `AppSettings` 인터페이스 |
| `build/iconTemplateAlert.png`, `iconTemplateAlert@2x.png` | 정체 알림 트레이 뱃지 변형 |
| `src/__tests__/sessionAlertMonitor.test.ts` | 단위 테스트 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `electron/main.ts` | `SessionAlertMonitor` 통합, `broadcastSessions` 안에서 호출, `Notification` import, 트레이 setImage 토글, IPC `get-settings`/`update-settings`/`show-main-window-tab` |
| `electron/preload.ts` | `getSettings`, `updateSettings`, `onSettingsUpdated`, `showMainWindowTab` |
| `src/types/stats.ts` | `ElectronAPI`에 settings 메서드 추가 |
| `src/App.tsx` | `TabType`에 `"settings"` 추가, `activeTab` 외부 제어 (IPC 수신) |
| `src/components/TabBar.tsx` | "설정" 탭 추가 |
| `src/components/PopoverApp.tsx` | 헤더에 ⚙️ 버튼 추가 |

## 단계적 구현

3개 단위로 분리. 각 단계는 독립적으로 동작 가능.

1. **1단계** — ConfigStore + SettingsTab + IPC (알림 무관, 설정 인프라만). 머지해도 향후 다른 설정 추가 기반이 됨.
2. **2단계** — SessionAlertMonitor + Notification 발사 (단위 테스트 포함).
3. **3단계** — 트레이 뱃지 토글 + 팝오버 ⚙️ 버튼 + 탭 외부 제어.

## 검증

### 단위 테스트 (`src/__tests__/sessionAlertMonitor.test.ts`)

- active→idle 전환 시 completion alert 1회 발사
- 첫 폴링에서 idle인 세션은 알림 X (앱 시작 직후 false-positive 방지)
- active 지속이 임계값 이상일 때 stuck alert 발사
- 재알림 간격 미달 시 추가 알림 X
- 재알림 간격 경과 후 재발사 O
- settings에서 disabled면 발사 X
- 같은 active 사이클 안에서 completion alert는 1회만

### 수동 검증

1. `npm run dev` → 메인 창 열림 → 설정 탭에서 임계 시간을 1분으로 낮춤
2. 더미 세션 파일을 `~/.claude/sessions/`에 만들고 PID를 실제 사용 중인 프로세스로 지정 → 1분 후 정체 알림 확인
3. 더미 세션 PID를 종료된 PID로 변경 → 다음 폴링에서 💤 전환 → 작업 완료 알림 확인
4. 알림 클릭 → 팝오버 열림
5. 트레이 아이콘이 정체 시 점 표시로 바뀌고 해소 시 복귀
6. 팝오버 ⚙️ 클릭 → 메인 창 + 설정 탭 활성
7. 마스터 토글 OFF 시 어떤 알림도 발사 X
8. `npm test` 49+신규 테스트 통과
9. `npm run build` 성공
