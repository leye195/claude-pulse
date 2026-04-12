# 코딩 컨벤션

## 스타일링
- CSS 변수 사용: `--bg-card`, `--border`, `--text-primary`, `--text-secondary`, `--badge-bg`
- Tailwind의 `bg-(--bg-card)` 또는 `bg-[var(--bg-card)]` 형태로 CSS 변수 참조
- 카드: `bg-(--bg-card) border border-(--border) rounded-lg p-5`
- 버튼(선택): `px-3 py-1 rounded text-xs cursor-pointer transition-colors`

## 컴포넌트 패턴
- 차트 컴포넌트: `useMemo`로 데이터 변환 → Recharts `ResponsiveContainer` → 차트
- Tooltip 스타일: `{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12 }`
- 기간 필터: `PERIODS` 상수 배열 + `selectedPeriod` 상태

## 데이터 훅 패턴
- TanStack Query: `refetchInterval: 30_000`, `refetchOnWindowFocus: true`, `retry: 2`
- IPC push 수신: `useEffect` + `onXxxUpdated` 콜백
- 반환: `{ data, loading, error, retry }`

## IPC 패턴
- Main → Renderer push: `mainWindow.webContents.send("channel-name", data)`
- Renderer → Main request: `ipcMain.handle("channel-name", handler)` + `ipcRenderer.invoke("channel-name")`

## 테스트
- Vitest + jsdom 환경
- utils 함수에 대한 유닛 테스트 (컴포넌트 테스트 없음)
- 샘플 데이터를 파일 상단에 정의
