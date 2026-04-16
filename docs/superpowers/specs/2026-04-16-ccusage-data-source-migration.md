# ccusage 데이터 소스 마이그레이션 + 비용 표시

## 배경

기존 앱은 `~/.claude/stats-cache.json`을 직접 읽어서 사용 통계를 표시했다. 두 가지 문제가 있었다:

1. **staleness**: stats-cache.json은 Claude Code에서 `/stats` 명령을 실행해야만 갱신된다. 앱을 열어도 마지막 `/stats` 실행 시점의 데이터만 보인다.
2. **비용 부재**: 모델별 토큰 수는 있지만 가격 정보가 없어서 USD 비용을 표시할 수 없었다.

## 해결: ccusage 라이브러리 도입

[ccusage](https://github.com/ryoppippi/ccusage) (npm, MIT, v18.x)는 `~/.claude/projects/**/*.jsonl` 원본 세션 로그를 직접 파싱하는 라이브러리다.

### 선택 이유

| 비교 항목 | 기존 (stats-cache.json) | ccusage |
|---|---|---|
| 데이터 신선도 | `/stats` 실행 시에만 갱신 | 원본 JSONL 직접 읽기 — 항상 최신 |
| 비용 계산 | 없음 | LiteLLM 최신 가격표로 USD 자동 계산 |
| 일별/모델별 집계 | 사전 집계된 JSON | `loadDailyUsageData()` — 일별/모델별 토큰+비용 |
| 세션 목록 | 총 수만 제공 | `loadSessionData()` — 세션별 상세 정보 |
| 통합 방식 | `fs.readFileSync` | ESM 라이브러리 import (Node ≥20.19.4) |

### 대안 검토

- **CLI exec** (`npx ccusage daily --json`): 30초 폴링마다 서브프로세스 오버헤드 → 비채택
- **MCP server**: Electron 앱 내부 데이터 소스로는 과도한 인프라 → 비채택
- **라이브러리 import**: 타입 안정성, 오버헤드 없음, Electron 41 Node 22 호환 → **채택**

## 아키텍처

### 변경 전

```
~/.claude/stats-cache.json → fs.readFileSync → IPC → renderer
```

### 변경 후

```
~/.claude/projects/**/*.jsonl
  ├─ ccusage loadDailyUsageData() → 토큰/비용 집계
  ├─ ccusage loadSessionData()    → 세션 정보
  └─ statsAdapter walkJsonl()     → messageCount, toolCallCount, hourCounts
      ↓
  statsAdapter.ts (어댑터) → StatsData 형태로 변환 → IPC → renderer
```

### 핵심 설계 결정: 어댑터 레이어

ccusage의 타입(`DailyUsage`, `SessionUsage`)을 기존 앱의 `StatsData` 타입으로 변환하는 어댑터를 둔다.

**이유**: renderer 코드(컴포넌트, 훅, 파서)를 전혀 수정하지 않고 데이터 소스만 교체하기 위함.

### ccusage가 제공하지 않는 데이터

ccusage는 토큰/비용 집계에 특화되어 있어서 다음 데이터는 직접 계산한다:

| 필드 | 방법 |
|---|---|
| `messageCount` (일별) | 원본 JSONL에서 `type === "assistant"` 엔트리 카운트 |
| `toolCallCount` (일별) | assistant 메시지의 `content[].type === "tool_use"` 카운트 |
| `sessionCount` (일별) | distinct `sessionId` per date |
| `hourCounts` | assistant 메시지 타임스탬프의 시간대별 분포 |
| `longestSession` | 세션별 첫/마지막 타임스탬프 차이 |
| `firstSessionDate` | 가장 오래된 타임스탬프 |

이 계산은 `statsAdapter.ts`의 `walkJsonl()` 함수가 담당한다.

## 변경 파일

### 신규

| 파일 | 역할 |
|---|---|
| `electron/statsAdapter.ts` | ccusage + JSONL walker → StatsData 변환 어댑터 |

### 수정

| 파일 | 변경 내용 |
|---|---|
| `electron/main.ts` | `readStatsFile()` 제거, `loadStatsData()` import. IPC 핸들러 3곳 + focus/tray 이벤트 2곳을 비동기 호출로 변경 |
| `package.json` | `ccusage` 의존성 추가 |
| `tsconfig.node.json` | `skipLibCheck: true` 추가 (ccusage 내부 타입 이슈 우회) |
| `src/types/stats.ts` | `dailyCosts: Record<string, number>` 필드 추가 |
| `src/components/SummaryCards.tsx` | "사용 기간" / "총 세션" 카드 → "오늘 비용" / "총 비용" 교체 |
| `src/components/ModelBreakdown.tsx` | 범례에 모델별 USD 비용 표시 추가 |

### 유지 (변경 없음)

- `src/types/history.ts` — history.jsonl은 ccusage 범위 밖, 기존대로 유지
- `src/hooks/*` — IPC 채널 구조 동일, 수정 불필요
- `src/utils/statsParser.ts` / `historyParser.ts` — 어댑터가 기존 형태 반환
- `src/components/*` (SummaryCards, ModelBreakdown 제외) — 데이터 형태 동일

## 비용 표시 UI

### SummaryCards (4개 카드)

```
┌────────────┬────────────┬────────────┬────────────┐
│ 오늘 토큰   │ 오늘 메시지  │ 오늘 비용   │  총 비용    │
│ 1,234,567  │    128     │  $4.52     │ $371.00   │
│ (blue)     │ (green)    │ (emerald)  │ (orange)   │
└────────────┴────────────┴────────────┴────────────┘
```

- 오늘 데이터 없으면 "최근 비용 (MM/DD)" 형태로 폴백
- `$1 이상` → 소수점 2자리, `$1 미만` → 소수점 3자리

### ModelBreakdown 범례

```
● Opus 4.6    85.2% (1,240,414)  $344.52
● Haiku 4.5   12.3% (291,675)    $24.17
● Sonnet 4.6   2.5% (23,768)     $4.25
```

비용이 0보다 큰 모델만 금액 표시 (emerald 컬러).

## 트러블슈팅: CLI와 값 불일치

### 증상

`npx ccusage daily`의 총 비용과 앱 표시 값이 $4 차이.

### 원인 및 해결

| 원인 | 해결 |
|---|---|
| 어댑터가 `offline: true` 사용 → 내장 가격표(약간 오래된 값) | `offline` 옵션 제거 → LiteLLM 최신 가격 사용 (CLI와 동일) |
| `loadDailyUsageData()` 반환이 내림차순 | `.sort()` 추가 → 오름차순 정렬 |

해결 후 과거 날짜 비용이 소수점 4자리까지 정확 일치 확인.

## 검증

1. **어댑터 단독 테스트**: `node --input-type=module`로 `loadStatsData()` 호출 → 43일 데이터, 5개 모델, costUSD 실제 값 확인
2. **CLI 비교**: `npx ccusage daily --json`와 과거 날짜 비용 소수점 4자리 일치
3. **기존 테스트**: `npm test` → 72개 전부 통과 (statsParser 25개 + historyParser 47개)
4. **타입 체크**: `npx tsc -p tsconfig.node.json --noEmit` 통과
5. **Electron 실행**: `npm run dev` → UI에서 비용 카드 및 모델별 비용 표시 확인
