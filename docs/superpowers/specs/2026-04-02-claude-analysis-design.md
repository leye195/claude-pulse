# Claude Analysis - Design Spec

## Context

Claude Code 사용자가 자신의 토큰 사용 패턴을 시각적으로 파악할 수 있는 데스크톱 앱이 필요하다. 현재 `~/.claude/stats-cache.json`에 일별 토큰 사용량 데이터가 저장되어 있지만, 이를 쉽게 확인할 방법이 없다. GitHub의 잔디(contribution graph) 스타일로 일별 사용량을 한눈에 보고, 차트로 추세를 파악할 수 있는 앱을 만든다.

## Tech Stack

- **Runtime**: Electron (Mac/Windows 크로스 플랫폼)
- **Frontend**: React 18 + TypeScript
- **Build**: Vite + electron-builder
- **Chart**: Recharts
- **Styling**: Tailwind CSS
- **Theme**: Light/Dark 모드 지원 (시스템 설정 감지 + 수동 토글)

## Data Source

- `~/.claude/stats-cache.json` 직접 읽기 (Node.js fs 모듈, Electron main process)
- 앱 시작 시 파일을 읽고, 포커스 복귀 시 자동 갱신
- 별도 DB 없이 해당 파일의 데이터를 그대로 사용

### stats-cache.json 구조

```json
{
  "version": 2,
  "lastComputedDate": "2026-02-22",
  "dailyActivity": [
    { "date": "2026-02-03", "messageCount": 310, "sessionCount": 4, "toolCallCount": 47 }
  ],
  "dailyModelTokens": [
    { "date": "2026-02-03", "tokensByModel": { "claude-opus-4-6": 25748 } }
  ],
  "modelUsage": { ... },
  "totalSessions": 28,
  "totalMessages": 5360,
  "firstSessionDate": "2026-02-03T02:19:26.160Z",
  "hourCounts": { "10": 1, "11": 10, ... }
}
```

## Architecture

```
claude-analysis/
├── electron/
│   ├── main.ts          # Electron main process
│   └── preload.ts       # IPC bridge (exposes file read API)
├── src/
│   ├── App.tsx           # Root component, theme provider
│   ├── components/
│   │   ├── TopBar.tsx         # 앱 이름 + 요약 뱃지 + 테마 토글
│   │   ├── SummaryCards.tsx   # 4개 요약 카드
│   │   ├── ContributionGraph.tsx  # GitHub 스타일 잔디 heatmap
│   │   ├── DailyChart.tsx     # 일별 토큰 사용량 바 차트 (모델별 스택 지원)
│   │   ├── ModelBreakdown.tsx # 모델별 사용 비율 파이 차트
│   │   └── ThemeToggle.tsx    # Light/Dark 토글 버튼
│   ├── hooks/
│   │   ├── useStatsData.ts    # stats-cache.json 읽기 + 파싱
│   │   └── useTheme.ts        # 테마 상태 관리
│   ├── types/
│   │   └── stats.ts           # TypeScript 타입 정의
│   └── utils/
│       └── statsParser.ts     # 데이터 변환/집계 유틸
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── tsconfig.json
```

### Data Flow

1. **Electron main process** (`electron/main.ts`): `~/.claude/stats-cache.json` 파일 읽기
2. **Preload script** (`electron/preload.ts`): IPC를 통해 renderer에 안전하게 데이터 전달
3. **useStatsData hook**: IPC로 데이터 요청 → 파싱 → React state로 관리
4. **Components**: hook에서 받은 데이터를 시각화

### IPC API

```typescript
// preload.ts - contextBridge로 노출
interface ElectronAPI {
  getStatsData(): Promise<StatsData>;
  onStatsUpdated(callback: (data: StatsData) => void): void;
}
```

## UI Components

### 1. TopBar

- 앱 이름: "Claude Analysis"
- 요약 뱃지: 총 메시지 수, 총 세션 수
- 테마 토글 버튼 (🌙/☀️)

### 2. SummaryCards (4개)

| 카드 | 데이터 소스 | 설명 |
|------|-----------|------|
| 오늘 토큰 | dailyModelTokens (오늘 날짜) | 오늘 사용한 총 토큰 수 |
| 오늘 메시지 | dailyActivity (오늘 날짜) | 오늘 보낸 메시지 수 |
| 총 세션 | totalSessions | 전체 세션 수 |
| 사용 기간 | firstSessionDate ~ 오늘 | 첫 사용일부터 경과 일수 |

### 3. ContributionGraph (잔디 heatmap)

- GitHub contribution graph와 동일한 레이아웃
- X축: 주 단위 (최근 52주 또는 데이터가 있는 기간)
- Y축: 요일 (일~토)
- 색상: 5단계 (없음, 적음, 보통, 많음, 매우 많음)
  - Dark: `#161b22` → `#0e4429` → `#006d32` → `#26a641` → `#39d353`
  - Light: `#ebedf0` → `#9be9a8` → `#40c463` → `#30a14e` → `#216e39`
- 색상 기준: 일별 총 토큰 사용량 (dailyModelTokens의 모든 모델 합산)
- 마우스 호버 시 툴팁: 날짜 + 토큰 수
- 월 레이블 표시
- 하단 범례: Less ☐☐☐☐☐ More

### 4. DailyChart (일별 차트)

- Recharts BarChart 사용
- X축: 날짜
- Y축: 토큰 수
- 기간 필터 버튼: 7일 / 30일 / 전체
- 표시 모드 토글: 합산(단일 바) / 모델별(스택 바)
- 모델별 스택 바: 각 모델에 고유 색상 할당 (Opus=보라, Sonnet=파랑, Haiku=초록 계열)
- 마우스 호버 시 툴팁: 날짜 + 모델별 토큰 수

### 5. ModelBreakdown (모델별 통계)

- Recharts PieChart 사용
- 전체 기간 모델별 총 토큰 사용 비율 표시
- 데이터 소스: `modelUsage`의 `inputTokens + outputTokens` 합산
- 각 모델별 고유 색상
- 모델명 간소화 표시 (예: `claude-opus-4-6` → `Opus 4.6`)
- 범례: 모델명 + 비율(%) + 토큰 수

## Theme System

- CSS custom properties 기반
- `prefers-color-scheme` 미디어 쿼리로 시스템 설정 감지
- localStorage에 사용자 선택 저장
- `data-theme="dark|light"` 속성으로 전환

## Error Handling

- stats-cache.json 파일이 없는 경우: "Claude Code 사용 데이터가 없습니다" 메시지 표시
- 파일 파싱 실패 시: 에러 메시지 표시 + 재시도 버튼
- 데이터가 비어있는 경우: 빈 잔디 그래프 + "아직 사용 기록이 없습니다" 표시

## Build & Distribution

- `electron-builder`로 Mac (.dmg) / Windows (.exe) 빌드
- Auto-update는 v1에서 제외 (수동 배포)

## Verification

1. `npm run dev`로 개발 서버 실행 → Electron 창에서 대시보드 확인
2. stats-cache.json 데이터가 잔디 그래프에 올바르게 표시되는지 확인
3. 일별 차트에서 기간 필터 (7일/30일/전체) 전환 동작 확인
3-1. 일별 차트에서 합산/모델별 표시 모드 토글 확인
3-2. 모델별 파이 차트에서 비율 표시 + 범례 확인
4. Light/Dark 테마 토글 동작 확인
5. stats-cache.json 파일이 없는 경우 에러 메시지 표시 확인
6. `npm run build`로 프로덕션 빌드 → 패키지 실행 확인
