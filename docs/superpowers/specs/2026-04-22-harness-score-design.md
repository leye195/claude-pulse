# 하네스 점수 탭 설계

## 배경

현재 앱에는 "사용량 분석 / 프로젝트 활동 / 스킬 분석" 3개 탭이 있지만, 각 프로젝트가 Claude Code의 하네스(harness: `.claude/` 구성물, `CLAUDE.md`, `.mcp.json`)를 얼마나 잘 갖췄는지 비교하는 지표는 없다. 어떤 프로젝트가 CLAUDE.md·hooks·MCP·커스텀 커맨드/에이전트/스킬을 갖추고 있는지 한눈에 보고, 하네스 구성 품질 개선 포인트를 파악할 수 있도록 4번째 탭 "하네스 점수"를 추가한다.

## 목표

프로젝트별 하네스 구성 품질을 100점 만점 + 등급(S/A/B/C/D) + 항목별 달성 배지로 가시화한다. 채점은 `history.jsonl`에 기록된 모든 프로젝트 경로에 대해 실제 파일 시스템을 탐색해 수행한다.

## 데이터 소스

- `~/.claude/history.jsonl` → 기존 `useHistoryData` 훅으로 수집된 unique `project` 경로
- 각 프로젝트 디렉토리의 실제 파일(읽기 전용):
  - `<root>/CLAUDE.md` 또는 `<root>/.claude/CLAUDE.md`
  - `<root>/.claude/settings.json`, `<root>/.claude/settings.local.json`
  - `<root>/.claude/commands/*.md`
  - `<root>/.claude/agents/*.md`
  - `<root>/.claude/skills/*.md` 또는 `<root>/.claude/skills/<name>/SKILL.md`
  - `<root>/.mcp.json`

### 경로 정규화

`history.jsonl`에 기록된 경로가 워크트리(`.../<project>/.claude/worktrees/xxx`)인 경우, `.claude` 세그먼트 이전 구간을 실제 프로젝트 루트로 환원해 채점한다. 존재하지 않는 경로(삭제된 프로젝트)는 `exists: false`로 마킹해 "채점 불가" 섹션에 분리한다.

## 스코어링 루브릭 (총 100점)

| 카테고리 | 배점 | 세부 |
|---------|-----|------|
| **CLAUDE.md** | 25 | 존재 15 + 30줄 이상 10 |
| **settings** | 25 | `settings.json` 또는 `settings.local.json` 10 + `hooks` 블록 8 + `permissions` 배열(allow/deny/ask 합계) 7 |
| **commands/agents/skills** | 25 | 각 카테고리: 0개→0 / ≥1→5 / ≥3→9 (상한 25) |
| **MCP** | 25 | `.mcp.json` 존재 15 + 서버 ≥1 10 |

**등급**: ≥90 S / ≥75 A / ≥60 B / ≥40 C / 그 외 D

## 아키텍처

```
useHistoryData (기존) ─→ unique project paths
        │
        ▼
useHarnessData (신규, TanStack Query, 60s 폴링)
        │  IPC: get-harness-configs
        ▼
electron/harnessReader.ts
  ├─ resolveProjectRoot (워크트리 정규화)
  ├─ countLines, readJsonSafe, countMarkdownFiles, countSkills
  └─ readHarnessConfigs(paths[]) → HarnessRawConfig[]
        │
        ▼
src/utils/harnessScorer.ts (순수 함수)
  └─ scoreHarnessAll(raw[]) → HarnessScore[] (점수/등급/배지/breakdown)
        │
        ▼
HarnessTab 렌더링
```

**파일 I/O는 main process, 스코어링은 renderer**의 순수 함수로 분리 — 스코어링 로직을 vitest로 단위 테스트하기 위함.

## 타입 정의

`src/types/harness.ts` (신규):

```ts
export interface HarnessRawConfig {
  project: string;                    // 원본 경로 (history의 cwd)
  resolvedPath: string;               // 실제 채점한 경로 (워크트리 환원 후)
  projectName: string;
  exists: boolean;
  claudeMd: { exists: boolean; lines: number };
  settings: {
    hasSettings: boolean;
    hasLocal: boolean;
    hasHooks: boolean;
    permissionCount: number;
  };
  commands: number;
  agents: number;
  skills: number;
  mcp: { exists: boolean; serverCount: number };
}

export type HarnessGrade = "S" | "A" | "B" | "C" | "D";

export interface HarnessBadge {
  id: HarnessBadgeId;                 // "claude-md" | "hooks" | ... 10종
  label: string;                      // 한국어 라벨
  achieved: boolean;
  detail?: string;                    // 예: "156줄", "서버 2개"
}

export interface HarnessBreakdown {
  claudeMd: number;
  settings: number;
  extensions: number;
  mcp: number;
}

export interface HarnessScore extends HarnessRawConfig {
  score: number;
  grade: HarnessGrade;
  breakdown: HarnessBreakdown;
  badges: HarnessBadge[];
}
```

## UI 구성

### 탭 추가

`TabBar`에 4번째 탭 "하네스 점수" 추가 (`TabType = "stats" | "projects" | "skills" | "harness"`).

### 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ [평균 점수] [최고 점수] [S등급 수] [채점 프로젝트 수]          │  HarnessSummaryCards
├───────────────────────────────┬─────────────────────────────┤
│ 카테고리별 평균 (바차트)        │ 등급 분포 (도넛)              │
├───────────────────────────────┴─────────────────────────────┤
│ 프로젝트별 하네스 점수 (테이블, 행 클릭 확장)                   │  HarnessTable
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 프로젝트          점수  CLAUDE.md  Settings  확장  MCP 등급│ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▸ claude-analysis  92   25/25     20/25    25/25 22/25 S │ │
│ │ ▾ other-proj       48   15/25     10/25     8/25 15/25 C │ │
│ │   [✓CLAUDE.md 40줄] [✗hooks] [✓permissions 3개]          │ │
│ │   [✓commands×2] [✗agents] [✗skills] [✓.mcp.json]         │ │
│ │   [✗MCP 서버]                                             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ... (나머지 프로젝트)                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ▶ 채점 불가 (N개) — 디렉토리 없음 (펼칠 수 있는 목록)           │
└─────────────────────────────────────────────────────────────┘
```

### 컴포넌트 상세

#### HarnessSummaryCards
- 4개 카드 (`CardGrid` 재사용)
- 평균 점수 (text-blue-400), 최고 점수+프로젝트명 (text-green-400), S등급 개수 (text-purple-400), 채점 프로젝트 수 (text-orange-400)
- `useAnimatedNumber`로 수치 보간

#### HarnessCategoryChart (바차트)
- 4개 카테고리(CLAUDE.md / Settings / 확장 / MCP)의 전체 프로젝트 평균 점수
- Y축 0~25 고정, 카테고리별 Cell 색상 (`#3b82f6`, `#a855f7`, `#22c55e`, `#f59e0b`)

#### HarnessGradeChart (도넛)
- `ProjectBreakdown.tsx` 패턴 따름
- S/A/B/C/D 등급별 프로젝트 수 + 우측 범례에 퍼센트
- 등급별 색상: S=purple, A=blue, B=green, C=amber, D=red

#### HarnessTable (테이블 + 행 확장)
- 컬럼: 프로젝트 / 점수 / CLAUDE.md / Settings / 확장 / MCP / 등급
- 기본 정렬: 점수 내림차순, 컬럼 헤더 클릭으로 정렬 키 변경
- 행 클릭 시 아래에 배지 리스트 + 실제 채점된 경로 펼침 (단일 행만 확장)
- 배지: 달성 시 녹색 테두리 + `✓`, 미달성 시 회색 + `✗`
- 테이블 하단 접힌 "채점 불가" 섹션에 `exists: false` 프로젝트 목록

#### HarnessTab
- `useHarnessData(projectPaths)` 호출
- 로딩/에러/빈 상태 처리 (`EmptyState` 재사용)
- 위 컴포넌트 4개 조합

## 파서 / 스코어러 함수

`src/utils/harnessScorer.ts`:

| 함수 | 입력 | 출력 | 설명 |
|------|------|------|------|
| `scoreHarness` | `HarnessRawConfig` | `HarnessScore` | 단일 프로젝트 점수/등급/배지 |
| `scoreHarnessAll` | `HarnessRawConfig[]` | `HarnessScore[]` | 정렬 (exists 우선, 점수 내림차순) |

`electron/harnessReader.ts`:

| 함수 | 입력 | 출력 | 설명 |
|------|------|------|------|
| `resolveProjectRoot` | `string` | `string` | `.claude` 세그먼트 이전 경로로 환원 |
| `readHarnessConfigs` | `string[]` | `HarnessRawConfig[]` | 각 경로의 `.claude/` 탐색 + 중복 제거 |

## IPC 패턴

- `get-harness-configs` (renderer → main): `ipcMain.handle("get-harness-configs", handler)` + `ipcRenderer.invoke("get-harness-configs", projectPaths)`
- Push 업데이트는 없음 (TanStack Query 60초 폴링 + 포커스 시 refetch)

## 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/types/harness.ts` | 신규 | HarnessRawConfig / HarnessScore / HarnessBadge / HarnessBreakdown |
| `src/types/stats.ts` | 수정 | `ElectronAPI`에 `getHarnessConfigs` 추가 |
| `src/utils/harnessScorer.ts` | 신규 | 순수 스코어링 함수 + 상수 (카테고리 라벨/등급 색상) |
| `src/__tests__/harnessScorer.test.ts` | 신규 | 루브릭 경계 케이스 유닛 테스트 (12개) |
| `src/hooks/useHarnessData.ts` | 신규 | TanStack Query 훅 |
| `src/components/HarnessTab.tsx` | 신규 | 탭 오케스트레이터 |
| `src/components/HarnessSummaryCards.tsx` | 신규 | 요약 카드 4개 |
| `src/components/HarnessCategoryChart.tsx` | 신규 | 카테고리별 평균 바차트 |
| `src/components/HarnessGradeChart.tsx` | 신규 | 등급 분포 도넛 |
| `src/components/HarnessTable.tsx` | 신규 | 정렬·확장 가능한 테이블 |
| `src/components/TabBar.tsx` | 수정 | `TabType`에 `"harness"` 추가 + 탭 라벨 |
| `src/App.tsx` | 수정 | HarnessTab 라우팅 연결 |
| `electron/harnessReader.ts` | 신규 | `.claude/` 탐색 로직 (main process) |
| `electron/main.ts` | 수정 | `get-harness-configs` IPC 핸들러 |
| `electron/preload.ts` | 수정 | `getHarnessConfigs(paths)` 브릿지 |

## 구현 순서

1. Types → 2. scoreHarness 테스트 먼저(TDD) → 3. harnessScorer 구현 → 4. harnessReader(main) + IPC + preload → 5. ElectronAPI 타입 확장 → 6. useHarnessData 훅 → 7. 컴포넌트 5개 → 8. TabBar/App 연결 → 9. `npm test` + `npm run build` 검증

## 검증

- **유닛 테스트**: `npm test` — 루브릭 경계값 (0점/만점/부분 달성/존재하지 않는 프로젝트/정렬)
- **통합**: `npm run dev` 후 "하네스 점수" 탭 진입
  - `claude-analysis`가 상위권에 노출되고 배지가 실제 `.claude/` 구성과 일치
  - 다른 프로젝트 점수를 `ls <project>/.claude/`로 교차 확인
  - 삭제된 경로가 "채점 불가" 섹션에 분리
  - 행 확장/축소 및 컬럼 정렬 동작
  - 라이트/다크 테마에서 배지/등급 색상 대비 양호
