import { useEffect, useState } from "react";
import type { ActiveSession } from "@/shared/types/stats";

function formatElapsed(startedAt: number): string {
  const diffMs = Date.now() - startedAt;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export function useSessions(): ActiveSession[] {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);

  useEffect(() => {
    let mounted = true;
    window.electronAPI.getSessions().then((s) => {
      if (mounted) setSessions(s);
    });
    const unsubscribe = window.electronAPI.onSessionsUpdated((s) => {
      setSessions(s);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return sessions;
}

export function SessionList({ sessions }: { sessions: ActiveSession[] }) {
  return (
    <section className="px-4 py-3 border-b border-(--border)">
      <div className="text-xs text-(--text-secondary) mb-2">활성 세션 ({sessions.length})</div>
      {sessions.length === 0 ? (
        <div className="text-xs text-(--text-secondary) py-2">실행 중인 세션이 없습니다</div>
      ) : (
        <ul className="space-y-1.5">
          {sessions.map((s) => (
            <li key={s.sessionId} className="flex items-center gap-2 text-xs">
              <span aria-hidden>{s.isActive ? "⚡" : "💤"}</span>
              <span className="font-medium text-(--text-primary) truncate flex-1">
                {s.projectName}
                {s.name ? <span className="text-(--text-secondary)"> — {s.name}</span> : null}
              </span>
              <span className="text-(--text-secondary) whitespace-nowrap">
                {formatElapsed(s.startedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
