# 데이터 소스

## stats-cache.json

경로: `~/.claude/stats-cache.json`
생성: Claude Code CLI에서 `/stats` 명령 실행 시 갱신
용도: 사용량 분석 탭 (토큰, 모델, 세션 통계)

```json
{
  "version": 1,
  "lastComputedDate": "2026-03-27",
  "dailyActivity": [
    { "date": "2026-03-10", "messageCount": 45, "sessionCount": 3, "toolCallCount": 120 }
  ],
  "dailyModelTokens": [
    { "date": "2026-03-10", "tokensByModel": { "claude-opus-4-6": 15000, "claude-sonnet-4-5-20250929": 3000 } }
  ],
  "modelUsage": {
    "claude-opus-4-6": {
      "inputTokens": 50000,
      "outputTokens": 20000,
      "cacheReadInputTokens": 10000,
      "cacheCreationInputTokens": 5000,
      "webSearchRequests": 0,
      "costUSD": 1.5,
      "contextWindow": 200000,
      "maxOutputTokens": 32000
    }
  },
  "totalSessions": 100,
  "totalMessages": 1500,
  "longestSession": { "sessionId": "...", "duration": 3600, "messageCount": 50, "timestamp": "..." },
  "firstSessionDate": "2025-10-16",
  "hourCounts": { "10": 120, "11": 200 },
  "totalSpeculationTimeSavedMs": 5000
}
```

## history.jsonl

경로: `~/.claude/history.jsonl`
생성: Claude Code CLI 사용 시 자동 기록 (프롬프트마다 1줄)
용도: 프로젝트 활동 탭 (프로젝트별 분석, 시간대 패턴)

```jsonl
{"display":"프롬프트 텍스트","timestamp":1775183888406,"project":"/Users/.../web","sessionId":"4b1aaa98-...","pastedContents":{}}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| display | string | O | 사용자가 입력한 프롬프트 |
| timestamp | number | O | Unix timestamp (ms) |
| project | string | O | 작업 프로젝트 경로 |
| sessionId | string | X | 세션 ID (최근 데이터에만 존재) |
| pastedContents | object | X | 붙여넣기 콘텐츠 |

### 참고사항
- sessionId가 없는 구 데이터는 같은 프로젝트 내 30분 gap으로 세션 구분
- 프로젝트 이름은 경로의 basename으로 표시
