# macOS 메뉴바 트레이 + 팝오버 윈도우

## Context

Claude Analysis 앱은 현재 메인 윈도우를 닫으면 앱이 종료된다. 사용자가 macOS 메뉴바에서 항상 접근할 수 있도록 트레이 아이콘 + 팝오버 윈도우를 추가한다. 팝오버에서는 실시간 세션 상태와 누적 통계를 빠르게 확인할 수 있다.

## 요구사항

- 메뉴바에 트레이 아이콘 상주
- 트레이 아이콘 클릭 시 팝오버 윈도우 토글 (보이기/숨기기)
- 팝오버에 활성 세션 목록 표시 (실시간 CPU 상태로 작업 중/대기 중 구분)
- 팝오버에 누적 통계 표시 (총 토큰, 메시지, 세션, 도구 호출)
- 팝오버에 추가 정보 표시 (사용 기간, 최장 세션)
- 팝오버에 최근 6개월 미니 잔디 (GitHub 스타일 컨트리뷰션 그래프)
- 팝오버에 최근 7일 토큰 바차트 (Recharts)
- 팝오버 헤더에 홈 버튼 → 메인 창 열기
- 메인 윈도우 닫기 시 앱 종료 대신 트레이로 숨기기
- 팝오버 바깥 클릭 시 자동 숨김
- 라이트/다크 테마 동기화
- Windows 경로 프로젝트명 추출 지원

## 아키텍처

```
Tray (main process)
  └── click → togglePopover()

~/.claude/sessions/*.json
  ├── fs.watch() + 5초 폴링
  └── readSessions() + getCpuPercent(pid)
        └── IPC "sessions-updated" → PopoverApp

Popover BrowserWindow (360x600, frameless)
  ├── 같은 index.html + ?popover=1 쿼리로 로드
  ├── blur → hide
  ├── 홈 버튼 → IPC "show-main-window" → 메인 창 열기
  └── 기존 IPC 채널 재사용 (get-stats-data, get-sessions)

Main BrowserWindow
  └── close → hide (앱 종료 대신)
```

### 왜 같은 HTML 엔트리 포인트를 쓰는가

- Vite 멀티페이지 설정 불필요
- preload, CSS 변수, Tailwind 스타일 공유
- `src/main.tsx`에서 `?popover=1` 쿼리 파라미터로 `PopoverApp` vs `App` 분기

## 팝오버 UI 레이아웃

```
┌──────────────────────────────────┐
│  Claude Analysis          [🏠]  │  40px 헤더 + 홈 버튼
├──────────────────────────────────┤
│  활성 세션 (3)                    │
│  ⚡ claude-analysis — tray-impl  │  CPU > 1% → 작업 중
│  💤 web — migrate-tailwind       │  CPU ≤ 1% → 대기 중
│  💤 web              6시간 전     │  경과 시간 표시
├──────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐  │
│  │ 총 토큰     │ │ 총 메시지    │  │
│  │  4.8M      │ │  29.3K     │  │  2x2 누적 통계 카드
│  └────────────┘ └────────────┘  │
│  ┌────────────┐ ┌────────────┐  │
│  │ 총 세션     │ │ 총 도구 호출 │  │
│  │    310     │ │  13.5K     │  │
│  └────────────┘ └────────────┘  │
│                                  │
│  사용 기간: 64일                  │
│  최장 세션: 8시간 10분            │  추가 정보
├──────────────────────────────────┤
│  최근 6개월                       │
│  ░░▓░▓▓░▓░░▓▓▓░▓░░▓▓░▓░░▓▓▓░  │  미니 잔디 (26주, 셀 9px)
│  ░▓▓░▓░▓▓░▓░░▓▓░▓░▓▓░▓░░▓▓░▓  │  getContributionLevel 재사용
│  ░░▓▓▓░▓░░▓▓░▓░▓▓░▓░░▓▓░▓░▓▓  │  --grass-* CSS 변수 색상
├──────────────────────────────────┤
│  최근 7일                         │
│  ┃ ┃   ┃ ┃ ┃ ┃ ┃               │  Recharts BarChart (60px)
│  04/02  04/05 04/08              │  날짜 라벨 + 토큰 툴팁
└──────────────────────────────────┘
```

## 활성 세션 기능

### 데이터 소스

`~/.claude/sessions/` 디렉토리:
- Claude Code 세션 시작 시 `{PID}.json` 파일 생성
- 세션 종료 시 파일 삭제
- 각 파일에 `pid`, `sessionId`, `cwd`, `startedAt`, `name` 포함

### 세션 데이터 타입

```ts
interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  projectName: string;  // path.basename(cwd)
  startedAt: number;
  name?: string;
  cpuPercent: number;   // ps -p {pid} -o %cpu= 로 취득
  isActive: boolean;    // cpu > 1%
}
```

### 실시간 업데이트

- `fs.watch('~/.claude/sessions/')` — 세션 추가/제거 감지
- `setInterval(5초)` — CPU 사용률 폴링
- 팝오버 열릴 때 최신 데이터 즉시 push
- IPC 채널: `get-sessions` (invoke), `sessions-updated` (push)

### 상태 표시

| CPU | 아이콘 | 의미 |
|-----|--------|------|
| > 1% | ⚡ | 작업 중 (Claude가 응답 생성/도구 실행 중) |
| ≤ 1% | 💤 | 대기 중 (사용자 입력 대기) |

## 누적 통계 데이터 소스

| 항목 | 소스 |
|------|------|
| 총 토큰 | `modelUsage` 전체 모델의 `inputTokens + outputTokens` 합계 |
| 총 메시지 | `StatsData.totalMessages` |
| 총 세션 | `StatsData.totalSessions` |
| 총 도구 호출 | `dailyActivity` 전체의 `toolCallCount` 합계 |
| 사용 기간 | `firstSessionDate`부터 오늘까지 일수 |
| 최장 세션 | `longestSession.duration` (ms → 시간/분 변환) |
| 미니 잔디 | `dailyModelTokens` 최근 26주 (getContributionLevel 재사용) |
| 바차트 | `dailyModelTokens` 최근 7개 항목 (Recharts BarChart) |

> **참고**: `costUSD`는 `stats-cache.json`에서 항상 0이므로 사용하지 않음. 대신 총 도구 호출 수를 표시.

## 동작 명세

| 동작 | 결과 |
|------|------|
| 트레이 아이콘 클릭 | 팝오버 토글. 열릴 때 최신 데이터 + 세션 push |
| 팝오버 바깥 클릭 | 팝오버 숨기기 (`blur` 이벤트) |
| 팝오버 홈 버튼 클릭 | 메인 창 열기 + 포커스, 팝오버 숨기기 (IPC `show-main-window`) |
| 메인 창 닫기 (X) | 트레이에 숨기기 (`event.preventDefault()` + `mainWindow.hide()`) |
| Dock 아이콘 클릭 | 메인 창 보이기 (`activate` 이벤트) |
| Cmd+Q | 앱 완전 종료 (`app.isQuitting` 플래그) |

## 트레이 아이콘

- macOS 템플릿 이미지 사용 (라이트/다크 메뉴바 자동 대응)
- 파일명: `build/iconTemplate.png` (16x16), `build/iconTemplate@2x.png` (32x32)
- 모노크롬 블랙 + 알파 채널
- 기존 컬러 아이콘에서 Pillow로 변환하여 생성

## 테마 동기화

메인 윈도우와 팝오버는 별도의 `BrowserWindow` (별도 localStorage, 별도 DOM).

동기화 방법:
1. 메인 윈도우에서 테마 변경 시 `window.electronAPI.notifyThemeChanged(theme)` 호출
2. Main process가 `theme-changed` IPC를 모든 윈도우에 브로드캐스트
3. 각 윈도우의 `useTheme` 훅이 수신하여 로컬 상태 업데이트

## Windows 크로스 플랫폼 지원

`parseProjectName()` (`src/utils/historyParser.ts`)이 `/`와 `\` 모두 처리:
- Windows 경로: `D:\2025\patrick\seoul-moment-api` → `seoul-moment-api`
- `.claude/worktrees` 하위 경로: `.claude` 앞의 프로젝트명 추출
- 예: `D:\...\seoul-moment-api\.claude\worktrees\refactor+admin-article` → `seoul-moment-api`

## 파일 변경 목록

### 수정한 파일

| 파일 | 변경 내용 |
|------|----------|
| `electron/main.ts` | Tray 생성, 팝오버 BrowserWindow (360x600), close-to-hide, 세션 읽기 (`readSessions` + `getCpuPercent`), `fs.watch` + 5초 폴링, `show-main-window`/`get-sessions`/`theme-changed` IPC |
| `electron/preload.ts` | `getSessions`, `onSessionsUpdated`, `showMainWindow`, `notifyThemeChanged`, `onThemeChanged` 추가 |
| `src/main.tsx` | `?popover=1` 쿼리 분기로 `PopoverApp` 렌더링 |
| `src/types/stats.ts` | `ActiveSession` 인터페이스 추가, `ElectronAPI`에 세션 + 테마 메서드 추가 |
| `src/hooks/useTheme.ts` | IPC 테마 동기화 로직 추가 (송신 + 수신) |
| `src/utils/historyParser.ts` | `parseProjectName()` Windows `\` 경로 + `.claude` 하위 경로 지원 |

### 생성한 파일

| 파일 | 용도 |
|------|------|
| `src/components/PopoverApp.tsx` | 팝오버 전용 루트 컴포넌트 (활성 세션, 통계 카드, 미니 잔디, Recharts 바차트, 홈 버튼) |
| `build/iconTemplate.png` | 16x16 macOS 템플릿 아이콘 |
| `build/iconTemplate@2x.png` | 32x32 macOS 템플릿 아이콘 (@2x) |

## 기술 참고사항

- **팝오버 위치**: `tray.getBounds()`로 트레이 아이콘 좌표 취득, 수평 중앙정렬 + 아래 4px 오프셋
- **클릭 외부 해제**: `popoverWindow.on("blur")` — 다른 곳 클릭, 앱 전환, Cmd+Tab 모두 처리
- **메모리**: 팝오버 윈도우는 한 번 생성 후 show/hide 토글 (매번 생성/파괴 안 함)
- **Notch 디스플레이**: `tray.getBounds()` 직접 사용하므로 메뉴바 높이 하드코딩 불필요
- **미니 잔디**: 셀 9px, 갭 2px, 26주. 기존 `getContributionLevel` 유틸 + `--grass-*` CSS 변수 재사용
- **바차트**: Recharts `BarChart` + `Tooltip` (앱 전체 Tooltip 스타일 컨벤션 준수)
- **costUSD 미사용**: `stats-cache.json`의 `costUSD`가 항상 0이므로 총 도구 호출로 대체
- **세션 CPU 체크**: `execSync('ps -p {pid} -o %cpu=')` — 2초 타임아웃, 실패 시 0% 반환
- **세션 프로젝트명**: `path.basename(cwd)` 사용 (main process에서 Node.js path 모듈)

## 검증 방법

1. `npm run dev`로 앱 실행 후 메뉴바에 트레이 아이콘 확인
2. 트레이 아이콘 클릭 → 팝오버 열림/닫힘 확인
3. 팝오버에 활성 세션 목록 (⚡/💤 + 프로젝트명 + 세션명 + 경과시간) 표시 확인
4. 새 Claude Code 세션 시작 → 세션 목록에 추가됨 확인
5. 세션 종료 → 세션 목록에서 제거됨 확인
6. 팝오버에 누적 통계 카드 4개 (토큰, 메시지, 세션, 도구 호출) 표시 확인
7. 팝오버에 미니 잔디 (최근 6개월) 표시 확인
8. 팝오버에 최근 7일 바차트 표시 확인
9. 팝오버 홈 버튼 클릭 → 메인 창 열림 확인
10. 팝오버 바깥 클릭 → 자동 숨김 확인
11. 메인 창 닫기 → 트레이에 숨김 (앱 종료 안 됨) 확인
12. Dock 클릭 → 메인 창 복원 확인
13. 메인 창에서 테마 변경 → 팝오버에도 반영 확인
14. Cmd+Q → 앱 완전 종료 확인
