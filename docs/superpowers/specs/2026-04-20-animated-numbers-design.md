# 숫자 카운트업 애니메이션 설계

## 배경

요약 카드의 숫자(토큰/메시지/비용 등)가 30초 폴링·윈도우 포커스 리페치 시 순간적으로 바뀌어 값 변화를 체감하기 어렵다. 토큰·비용처럼 누적되는 값이 "얼마나 늘었는지"가 시각적으로 전달되지 않는다.

## 포커스 리페치 동작 (현행)

"윈도우 포커스 시 리페치"는 이미 구현되어 있다. 본 스펙은 이 동작을 전제로 카운트업 애니메이션을 얹는다.

- `src/main.tsx:8-15`: QueryClient 기본값에 `refetchOnWindowFocus: true`
- `src/shared/hooks/useStatsData.ts:16`, `useHistoryData.ts:16`, `useHarnessData.ts:18`: 훅별로도 `refetchOnWindowFocus: true` 명시
- `electron/main.ts:144-153`: Electron 메인 프로세스 `mainWindow.on("focus")`가 최신 데이터를 읽어 `stats-updated` / `history-updated` IPC로 렌더러에 푸시
- `useStatsData.ts:20-26`, `useHistoryData.ts:20-26`: 훅 내부 `useEffect`가 IPC를 수신해 `queryClient.setQueryData`로 캐시 갱신

즉, 렌더러의 TanStack Query와 Electron 메인 프로세스 양쪽에서 포커스 이벤트를 커버한다. 추가 코드는 필요 없고, 동작 검증은 아래 "구현 순서"에 포함.

## 목표

요약 카드의 대표 숫자에 카운트업 애니메이션(약 700ms, easeOutCubic)을 적용해 값 변화가 자연스럽게 보이도록 한다.

트리거 정책:
- 초기 마운트: `0` → 현재값
- 값 변경 시: 현재 표시값 → 새 값
- 같은 값 재설정: 애니메이션 없음 (`useEffect` 의존성이 자동 처리)
- 탭 전환: 애니메이션 없음 (컴포넌트를 언마운트하지 않고 `hidden`으로 토글)

## 범위

애니메이션 적용 대상은 요약 카드의 숫자만으로 한정한다.

| 컴포넌트 | 파일 경로 | 적용 값 |
|----------|-----------|---------|
| `TopBar` | `src/shared/components/TopBar.tsx` | `totalMessages`, `totalSessions` |
| `SummaryCards` | `src/features/stats/components/SummaryCards.tsx` | `displayTokens`, `displayMessages`, `displayCost`, `totalCost` |
| `ProjectSummaryCards` | `src/features/projects/components/ProjectSummaryCards.tsx` | `totalProjects`, `totalMessages`, `activeDays` |

차트/랭킹/툴팁의 숫자, 문자열 값(`topProject` 등)은 제외. `HarnessTab`은 현재 점수 UI가 카드 형태가 아니므로 이번 범위에서 제외.

## 훅 설계

### `src/shared/hooks/useAnimatedNumber.ts`

```ts
export function useAnimatedNumber(value: number, duration = 700): number
```

동작:
- 내부 상태 `display`는 `0`으로 초기화
- `useEffect([value, duration])`에서 `requestAnimationFrame` 루프 시작
- 시작값: 현재 `display` (값 변경 시 중간값에서 이어서 보간)
- easing: easeOutCubic `1 - (1 - t)^3`
- 시작 시각: rAF 콜백의 첫 `now` 인자 사용 (`performance.now` 의존 X)
- 정수/정수 간 보간일 때는 `Math.round` 적용, 소수가 섞이면 원본 그대로 반환
- 언마운트·재실행 시 `cancelAnimationFrame` 정리

### StrictMode 고려

`<StrictMode>`에서 마운트 시 effect가 두 번 실행되므로, "이미 목표값에 도달했으면 스킵" 같은 가드를 두면 두 번째 실행에서 애니메이션이 건너뛰어지는 문제가 있다. 가드를 두지 않고 `useEffect`의 의존성 배열 `[value, duration]`에 맡기는 것으로 해결 — 같은 값에 대해서는 effect가 재실행되지 않고, StrictMode 재실행 때는 cleanup이 이전 rAF를 취소하고 새 rAF가 곧바로 다시 스케줄된다.

## 탭 렌더링 구조 변경

`App.tsx`에서 탭을 조건부 렌더링(`activeTab === "stats" && <StatsTab ... />`)하면 탭 전환 시 Summary 컴포넌트가 언마운트되어 재방문 시 `0`에서부터 카운트업이 재생된다. 이는 "값이 같을 땐 가만히 있어야 함"이라는 정책과 어긋난다.

해결: 네 개 탭(`stats`, `projects`, `harness`, `settings`)을 모두 마운트 상태로 두고 `hidden` 속성으로만 토글.

```tsx
<div hidden={activeTab !== "stats"}><StatsTab ... /></div>
<div hidden={activeTab !== "projects"}><ProjectsTab ... /></div>
<div hidden={activeTab !== "harness"}><HarnessTab ... /></div>
<div hidden={activeTab !== "settings"}><SettingsTab /></div>
```

데이터 훅은 `App` 레벨에서만 실행되고 탭은 props로 값을 받는 구조라 항상 마운트 비용이 낮다.

## 컴포넌트 적용 패턴

각 Summary 컴포넌트는 인라인 `<div className="text-2xl font-semibold …">` (또는 `TopBar`처럼 `<span>`)에 값을 직접 렌더한다. `CardGrid`/`StatCard` 같은 공용 래퍼는 본 범위에 없다. 훅을 호출한 뒤 기존 포맷터(`toLocaleString`, `formatCost`, `String`, `` `${n}일` `` 템플릿)를 그대로 적용.

```tsx
const animTokens = useAnimatedNumber(displayTokens);
// ...
<div className="text-2xl font-semibold text-blue-400">{animTokens.toLocaleString()}</div>
```

React hooks 규칙상 훅 호출은 고정 순서·고정 개수여야 하므로 각 값마다 개별 `useAnimatedNumber` 호출.

## 테스트

`src/__tests__/useAnimatedNumber.test.ts` 신규. jsdom 환경에서 `requestAnimationFrame`·`cancelAnimationFrame`을 글로벌 스텁으로 교체(`vi.stubGlobal`이 일부 환경에서 미동작 → `globalThis`/`window`에 직접 할당)하고 수동으로 프레임을 진행시키는 `flushFrames(ms)` 헬퍼로 제어.

검증 항목 (8개):
- 초기 렌더에서 `0`으로 시작
- duration이 지나면 목표값 도달
- 진행 중에는 시작값과 목표값 사이
- 두 값이 모두 정수면 정수로 반환
- 소수 값은 소수로 보간
- 값 변경 시 현재값에서 새 목표까지 보간
- 같은 값으로 재설정되면 `display` 유지
- 언마운트 시 `cancelAnimationFrame` 호출

## 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/shared/hooks/useAnimatedNumber.ts` | 신규 | 카운트업 훅 |
| `src/__tests__/useAnimatedNumber.test.ts` | 신규 | 훅 유닛 테스트 |
| `src/App.tsx` | 수정 | 4개 탭 렌더링 `hidden` 전환 |
| `src/shared/components/TopBar.tsx` | 수정 | `totalMessages`, `totalSessions` 애니메이션 |
| `src/features/stats/components/SummaryCards.tsx` | 수정 | 4개 카드 값 애니메이션 |
| `src/features/projects/components/ProjectSummaryCards.tsx` | 수정 | 3개 숫자 카드 애니메이션 |

## 구현 순서

1. `useAnimatedNumber` 훅 작성
2. 훅 유닛 테스트 작성 및 통과 확인
3. `App.tsx` 탭 렌더링 구조를 `hidden` 기반으로 전환
4. 세 개 Summary 계열 컴포넌트(`TopBar`, `SummaryCards`, `ProjectSummaryCards`)에 훅 적용
5. `npm test` 전체 통과, `npm run build` 성공
6. `npm run dev`로 개발 모드 수동 검증:
   - 앱 시작 시 요약 숫자가 `0`에서 현재값으로 카운트업
   - 30초 폴링으로 값이 바뀔 때 현재 표시값에서 새 값으로 부드럽게 보간
   - 탭 전환 후 재방문 시 카운트업 재생 없음 (값 유지)
   - 앱 창 포커스 아웃 → 포커스 인 시 값이 바뀌었다면 카운트업, 값이 같다면 변화 없음
   - DevTools Console/Network에서 IPC 수신(`stats-updated`) 또는 TanStack Query 네트워크 활동으로 포커스 리페치가 실제로 발생하는지 확인
