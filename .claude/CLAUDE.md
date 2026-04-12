# Claude Pulse

Claude Code 사용 통계를 시각화하는 Electron 데스크톱 앱.

## 기술 스택

- **런타임**: Electron 41
- **프론트엔드**: React 19 + TypeScript (Strict)
- **빌드**: Vite 5
- **차트**: Recharts 3
- **스타일링**: Tailwind CSS 4 (CSS 변수 기반 테마)
- **상태관리**: TanStack Query 5 (서버 상태), React hooks (UI 상태)
- **테스트**: Vitest + jsdom
- **패키징**: electron-builder

## 주요 명령어

```bash
npm run dev          # 개발 서버 + Electron 실행
npm run build        # 프로덕션 빌드
npm run package      # Electron 앱 패키징
npm test             # 테스트 실행 (vitest run)
npm run test:watch   # 테스트 워치 모드
```

## 아키텍처

### 데이터 흐름

```
~/.claude/stats-cache.json ──→ electron/main.ts (IPC) ──→ useStatsData hook ──→ 사용량 분석 탭
~/.claude/history.jsonl ────→ electron/main.ts (IPC) ──→ useHistoryData hook ──→ 프로젝트 활동 탭
```

- Electron main process에서 파일을 `fs.readFileSync`로 읽고 IPC로 renderer에 전달
- 30초 폴링 + 윈도우 포커스 시 자동 갱신
- 데이터 변환은 renderer의 utils에서 처리 (main process는 raw 데이터만 전달)

### 디렉토리 구조

```
electron/
  main.ts              # Electron 메인 프로세스 (IPC 핸들러, 파일 I/O)
  preload.ts           # Context bridge (electronAPI 노출)
  configStore.ts       # 설정 파일 읽기/쓰기
  sessionAlertMonitor.ts # 세션 알림 모니터링
src/
  App.tsx              # 루트 컴포넌트 (탭 전환, 데이터 오케스트레이션)
  main.tsx             # React 엔트리 (QueryClientProvider)
  index.css            # Tailwind + CSS 변수 (라이트/다크 테마)
  features/
    stats/             # 사용량 분석 탭
      StatsTab.tsx     # 탭 화면 컴포넌트
      SummaryCards.tsx, ContributionGraph.tsx, DailyChart.tsx,
      ModelBreakdown.tsx, ToolCallChart.tsx
    projects/          # 프로젝트 활동 탭
      ProjectsTab.tsx  # 탭 화면 컴포넌트
      ProjectSummaryCards.tsx, ProjectActivityTrend.tsx,
      ProjectBreakdown.tsx, HourlyChart.tsx, WeekdayHeatmap.tsx
    settings/          # 설정 탭
      SettingsTab.tsx
    popover/           # 트레이 팝오버
      PopoverApp.tsx
  shared/
    components/        # 공용 UI (EmptyState, TabBar, TopBar, ThemeToggle)
    hooks/             # 공용 훅 (useStatsData, useHistoryData, useTheme, useSettings)
    types/             # 공용 타입 (stats, history, settings)
    utils/             # 공용 유틸 (statsParser, historyParser, sessionAlertLogic)
  __tests__/           # 유닛 테스트
```

## 코딩 컨벤션

### 스타일링
- CSS 변수 사용: `--bg-card`, `--border`, `--text-primary`, `--text-secondary`, `--badge-bg`
- Tailwind의 `bg-(--bg-card)` 또는 `bg-[var(--bg-card)]` 형태로 CSS 변수 참조
- 카드: `bg-(--bg-card) border border-(--border) rounded-lg p-5`
- 버튼(선택): `px-3 py-1 rounded text-xs cursor-pointer transition-colors`

### 컴포넌트 패턴
- 차트 컴포넌트: `useMemo`로 데이터 변환 → Recharts `ResponsiveContainer` → 차트
- Tooltip 스타일: `{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12 }`
- 기간 필터: `PERIODS` 상수 배열 + `selectedPeriod` 상태

### 데이터 훅 패턴
- TanStack Query: `refetchInterval: 30_000`, `refetchOnWindowFocus: true`, `retry: 2`
- IPC push 수신: `useEffect` + `onXxxUpdated` 콜백
- 반환: `{ data, loading, error, retry }`

### IPC 패턴
- Main → Renderer push: `mainWindow.webContents.send("channel-name", data)`
- Renderer → Main request: `ipcMain.handle("channel-name", handler)` + `ipcRenderer.invoke("channel-name")`

### 테스트
- Vitest + jsdom 환경
- utils 함수에 대한 유닛 테스트 (컴포넌트 테스트 없음)
- 샘플 데이터를 파일 상단에 정의

## UI 언어
- 모든 라벨, 버튼, 메시지는 한국어
