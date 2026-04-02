# Claude Analysis

Claude Code 사용량을 시각적으로 분석할 수 있는 데스크톱 앱입니다.

`~/.claude/stats-cache.json` 데이터를 기반으로 GitHub 스타일의 잔디 그래프, 일별 토큰 사용량 차트, 모델별 통계를 제공합니다.

<!-- 스크린샷 추가 예정 -->
<!-- ![Screenshot](docs/screenshot.png) -->

## 주요 기능

- **잔디 Heatmap** — GitHub contribution graph 스타일로 일별 토큰 사용량 시각화
- **일별 토큰 차트** — 바 차트로 일별 추세 확인 (7일/30일/전체 필터)
- **모델별 스택 뷰** — Opus/Sonnet/Haiku 모델별 사용량을 색상으로 구분
- **모델별 파이 차트** — 전체 기간 모델별 토큰 사용 비율
- **요약 카드** — 최근 토큰, 메시지, 총 세션, 사용 기간
- **Light/Dark 테마** — 시스템 설정 감지 + 수동 토글
- **자동 갱신** — 30초 간격 + 윈도우 포커스 시 데이터 자동 새로고침

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Electron 41 |
| Frontend | React 19, TypeScript |
| Build | Vite 5 |
| Chart | Recharts |
| Styling | Tailwind CSS 4 |
| Data Fetching | TanStack Query |
| Test | Vitest |
| Packaging | electron-builder |

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 (Vite + Electron)
npm run dev

# 테스트
npm test

# 프로덕션 빌드
npm run build

# 앱 패키징 (.dmg / .exe)
npm run package
```

## 프로젝트 구조

```
claude-analysis/
├── electron/
│   ├── main.ts              # Electron main process (IPC, 파일 읽기)
│   └── preload.ts           # contextBridge (CJS)
├── src/
│   ├── main.tsx             # React 엔트리 (QueryClientProvider)
│   ├── App.tsx              # 루트 레이아웃
│   ├── index.css            # Tailwind + 테마 CSS 변수
│   ├── components/
│   │   ├── TopBar.tsx       # 앱 타이틀 + 요약 뱃지 + 테마 토글
│   │   ├── SummaryCards.tsx # 통계 카드 4개
│   │   ├── ContributionGraph.tsx  # 잔디 heatmap (SVG)
│   │   ├── DailyChart.tsx   # 일별 바 차트 + 모델별 스택
│   │   ├── ModelBreakdown.tsx # 모델별 파이 차트
│   │   ├── ThemeToggle.tsx  # 테마 전환 버튼
│   │   └── EmptyState.tsx   # 빈 상태 / 에러 UI
│   ├── hooks/
│   │   ├── useStatsData.ts  # TanStack Query 기반 데이터 fetching
│   │   └── useTheme.ts     # 테마 상태 관리
│   ├── types/
│   │   └── stats.ts         # TypeScript 타입 정의
│   └── utils/
│       └── statsParser.ts   # 데이터 변환/집계 유틸
├── src/__tests__/
│   └── statsParser.test.ts  # 유닛 테스트 (21개)
├── build/                   # 앱 아이콘 (icon.icns, icon.png)
├── .github/workflows/
│   └── release.yml          # CI: 태그 푸시 시 Mac/Win 빌드
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.preload.json
└── electron-builder.yml
```

## 데이터 소스

`~/.claude/stats-cache.json` 파일을 읽어 데이터를 표시합니다.

이 파일은 Claude Code CLI에서 `/stats` 명령을 실행할 때 갱신됩니다. 앱은 다음 시점에 자동으로 데이터를 다시 읽습니다:

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
