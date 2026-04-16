# Claude Pulse

Claude Code 사용량을 시각적으로 분석할 수 있는 데스크톱 앱입니다.

`~/.claude/projects/**/*.jsonl` 원본 세션 로그를 [ccusage](https://github.com/ryoppippi/ccusage) 라이브러리로 직접 파싱하여 항상 최신 사용량 + USD 비용을 표시합니다.

<!-- 스크린샷 추가 예정 -->
<!-- ![Screenshot](docs/screenshot.png) -->

## 주요 기능

### 사용량 분석 탭
- **잔디 Heatmap** — GitHub contribution graph 스타일로 일별 토큰 사용량 시각화
- **일별 토큰 차트** — 바 차트로 일별 추세 확인 (7일/30일/전체 필터)
- **모델별 스택 뷰** — Opus/Sonnet/Haiku 모델별 사용량을 색상으로 구분
- **모델별 파이 차트** — 전체 기간 모델별 토큰 사용 비율
- **요약 카드** — 최근 토큰, 메시지, 오늘 비용(USD), 총 비용
- **모델별 비용** — 모델 범례에 USD 비용 표시

### 프로젝트 활동 탭
- **프로젝트 요약 카드** — 총 프로젝트, 총 세션, 총 대화 턴, 가장 활발한 프로젝트
- **프로젝트별 파이 차트** — 프로젝트별 세션 비율
- **프로젝트 활동 추이** — 프로젝트별 일별 활동 스택 바 차트
- **시간대별 패턴** — 시간대별 사용 빈도 바 차트
- **요일별 히트맵** — 요일 × 시간대 사용 패턴 히트맵
- **도구 호출 차트** — 도구별 호출 횟수 통계

### 메뉴바 트레이 + 팝오버 (macOS)
- **트레이 아이콘** — 메뉴바 상주, 클릭 시 360x600 팝오버 토글
- **활성 세션 목록** — `~/.claude/sessions/*.json` 실시간 추적, CPU 사용률로 작업 중(⚡)/대기 중(💤) 구분
- **누적 통계 카드** — 총 토큰/메시지/세션/도구 호출 (2x2 그리드)
- **미니 잔디** — 최근 6개월 컨트리뷰션 그래프
- **최근 7일 바차트** — 일별 토큰 추이
- **홈 버튼** — 메인 창 빠르게 열기
- **백그라운드 상주** — 메인 창 닫아도 트레이로 숨김 (Cmd+Q로 완전 종료)

### 공통
- **Light/Dark 테마** — 시스템 설정 감지 + 수동 토글, 메인↔팝오버 자동 동기화
- **자동 갱신** — 30초 간격 + 윈도우 포커스 시 데이터 자동 새로고침
- **활성 세션 모니터링** — `fs.watch` + 5초 간격 CPU 폴링
- **크로스 플랫폼 경로** — Windows `\` 경로 및 `.claude/worktrees` 하위 경로에서 프로젝트명 추출 지원

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Electron 41 |
| Frontend | React 19, TypeScript |
| Build | Vite 5 |
| Chart | Recharts |
| Styling | Tailwind CSS 4 |
| Data Fetching | TanStack Query |
| Usage Analytics | ccusage (JSONL 파싱 + LiteLLM 비용 계산) |
| Test | Vitest |
| Lint | oxlint (typescript / react / import 플러그인) |
| Format | Prettier + prettier-plugin-organize-imports |
| Packaging | electron-builder |

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 (Vite + Electron)
npm run dev

# 테스트
npm test

# 린트 (oxlint)
npm run lint
npm run lint:fix

# 포맷팅 (Prettier — 미사용 import 자동 제거 + 정렬 포함)
npm run format
npm run format:check

# 프로덕션 빌드
npm run build

# 앱 패키징 (.dmg / .exe)
npm run package
```

## 코드 품질

- **oxlint** — Rust 기반 초고속 린터 (typescript/react/import 플러그인, correctness + suspicious 카테고리)
- **Prettier** — `printWidth: 100`, double quote, ES5 trailing comma
- **prettier-plugin-organize-imports** — 포맷할 때 TypeScript organize-imports로 미사용 import 자동 제거 + 정렬
- 설정: `.oxlintrc.json`, `.prettierrc.json`, `.prettierignore`

## 프로젝트 구조

```
claude-analysis/
├── electron/
│   ├── main.ts              # Electron main process (IPC, 윈도우 관리)
│   ├── statsAdapter.ts      # ccusage + JSONL walker → StatsData 어댑터
│   ├── configStore.ts       # 설정 저장/로드
│   ├── sessionAlertMonitor.ts # 세션 알림 모니터
│   └── preload.ts           # contextBridge (CJS)
├── src/
│   ├── main.tsx             # React 엔트리 (?popover=1 분기)
│   ├── App.tsx              # 루트 컴포넌트 (탭 전환, 데이터 오케스트레이션)
│   ├── index.css            # Tailwind + 테마 CSS 변수
│   ├── features/
│   │   ├── stats/           # 사용량 분석 기능
│   │   │   └── components/  # SummaryCards, ContributionGraph, DailyChart, ModelBreakdown 등
│   │   ├── projects/        # 프로젝트 활동 기능
│   │   │   └── components/  # ProjectSummaryCards, ProjectBreakdown, HourlyChart 등
│   │   ├── popover/         # 트레이 팝오버
│   │   │   └── components/  # PopoverApp, SessionList 등
│   │   └── settings/        # 설정 기능
│   │       └── components/  # SettingsPanel
│   ├── shared/
│   │   ├── components/      # TopBar, TabBar, ThemeToggle, EmptyState
│   │   ├── hooks/           # useStatsData, useHistoryData, useTheme, useSettings
│   │   ├── types/           # stats.ts, history.ts, settings.ts, tab.ts
│   │   └── utils/           # statsParser.ts, historyParser.ts
│   └── __tests__/           # 유닛 테스트 (statsParser, historyParser, settings 등)
├── build/                   # 앱 아이콘 + 트레이 템플릿 (icon.icns, iconTemplate.png, @2x)
├── .github/workflows/
│   └── release.yml          # CI: 태그 푸시 시 Mac/Win 빌드
├── .oxlintrc.json           # oxlint 설정
├── .prettierrc.json         # prettier 설정
├── .prettierignore
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.preload.json
└── electron-builder.yml
```

## 데이터 소스

| 파일 | 용도 | 사용처 |
|------|------|-----|
| `~/.claude/projects/**/*.jsonl` | 원본 세션 로그 (토큰, 비용, 메시지, 도구 호출) | 사용량 분석 탭, 팝오버 |
| `~/.claude/history.jsonl` | 세션/프로젝트별 활동 기록 | 프로젝트 활동 탭 |
| `~/.claude/sessions/*.json` | 실행 중 세션 (PID, cwd, sessionId) | 트레이 팝오버 활성 세션 |

JSONL 파싱은 `electron/statsAdapter.ts`에서 처리:
- **ccusage** `loadDailyUsageData()` → LiteLLM 최신 가격표로 USD 비용 계산
- **커스텀 walker** → 메시지 수, 도구 호출 수, 시간대 분포, 세션 정보 추출
- 결과를 30초 TTL 인메모리 캐시로 보관

앱은 다음 시점에 자동으로 데이터를 다시 읽습니다:

- 앱 시작 시
- 30초 간격 (TanStack Query `refetchInterval`)
- 윈도우 포커스 복귀 시

## 빌드 및 배포

### 로컬 패키징

```bash
npm run package
# macOS: release/Claude Analysis-{version}-arm64.dmg
```

### GitHub Actions (CI)

`v*` 태그를 푸시하면 자동으로 Mac/Windows 빌드가 실행되고 GitHub Release(Draft)에 업로드됩니다.

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 라이선스

ISC
