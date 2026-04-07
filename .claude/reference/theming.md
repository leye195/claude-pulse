# 테마 시스템

## CSS 변수

`src/index.css`에서 정의. `:root`(라이트) / `.dark`(다크) 두 세트.

### 배경/레이아웃
| 변수 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--bg-primary` | #ffffff | #0d1117 | body 배경 |
| `--bg-secondary` | #f6f8fa | #161b22 | 보조 배경 |
| `--bg-card` | #ffffff | #161b22 | 카드 배경 |
| `--border` | #d0d7de | #30363d | 테두리 |
| `--badge-bg` | #f0f3f6 | #21262d | 버튼/뱃지 배경 |

### 텍스트
| 변수 | 라이트 | 다크 |
|------|--------|------|
| `--text-primary` | #1f2328 | #f0f6fc |
| `--text-secondary` | #656d76 | #8b949e |

### 잔디 히트맵 (ContributionGraph)
| 변수 | 라이트 | 다크 |
|------|--------|------|
| `--grass-0` | #ebedf0 | #161b22 |
| `--grass-1` | #9be9a8 | #0e4429 |
| `--grass-2` | #40c463 | #006d32 |
| `--grass-3` | #30a14e | #26a641 |
| `--grass-4` | #216e39 | #39d353 |

## 차트 컬러

### 모델 컬러 (DailyChart, ModelBreakdown)
| 모델 | 색상 |
|------|------|
| Opus | #a855f7 (purple) |
| Sonnet | #3b82f6 (blue) |
| Haiku | #22c55e (green) |

### 프로젝트 컬러 (historyParser.ts PROJECT_COLORS)
`#3b82f6`, `#a855f7`, `#22c55e`, `#f59e0b`, `#ef4444`, `#06b6d4`, `#ec4899`, `#8b5cf6`

## 테마 전환
- `useTheme` 훅 → localStorage(`claude-analysis-theme`) 저장
- 시스템 다크모드 감지: `prefers-color-scheme: dark`
- `<html>` 태그에 `dark` 클래스 토글
