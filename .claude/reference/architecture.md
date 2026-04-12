# 아키텍처

## 데이터 흐름

```
~/.claude/stats-cache.json ──→ electron/main.ts (IPC) ──→ useStatsData hook ──→ 사용량 분석 탭
~/.claude/history.jsonl ────→ electron/main.ts (IPC) ──→ useHistoryData hook ──→ 프로젝트 활동 탭
```

- Electron main process에서 파일을 `fs.readFileSync`로 읽고 IPC로 renderer에 전달
- 30초 폴링 + 윈도우 포커스 시 자동 갱신
- 데이터 변환은 renderer의 utils에서 처리 (main process는 raw 데이터만 전달)

## 디렉토리 구조

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
