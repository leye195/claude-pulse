import type { HarnessBreakdown, HarnessGrade, HarnessScore } from "@/shared/types/harness";
import { HARNESS_GRADE_COLORS } from "@/shared/utils/harnessScorer";
import { useMemo, useState } from "react";

interface HarnessTableProps {
  scores: HarnessScore[];
}

type SortKey = "score" | "claudeMd" | "settings" | "extensions" | "mcp" | "name";

const COLUMNS: { key: SortKey; label: string; width: string }[] = [
  { key: "name", label: "프로젝트", width: "flex-1" },
  { key: "score", label: "점수", width: "w-20" },
  { key: "claudeMd", label: "CLAUDE.md", width: "w-24" },
  { key: "settings", label: "설정", width: "w-20" },
  { key: "extensions", label: "확장", width: "w-20" },
  { key: "mcp", label: "MCP", width: "w-20" },
];

function valueFor(score: HarnessScore, key: SortKey): number | string {
  if (key === "name") return score.projectName;
  if (key === "score") return score.score;
  return score.breakdown[key as keyof HarnessBreakdown];
}

function gradeBadge(grade: HarnessGrade) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
      style={{ background: HARNESS_GRADE_COLORS[grade] }}
    >
      {grade}
    </span>
  );
}

export function HarnessTable({ scores }: HarnessTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const existing = useMemo(() => scores.filter((s) => s.exists), [scores]);
  const missing = useMemo(() => scores.filter((s) => !s.exists), [scores]);

  const sorted = useMemo(() => {
    const rows = [...existing];
    rows.sort((a, b) => {
      const va = valueFor(a, sortKey);
      const vb = valueFor(b, sortKey);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [existing, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg overflow-hidden">
      <div className="flex items-center px-4 py-2 bg-(--badge-bg) text-xs font-semibold text-(--text-secondary)">
        <div className="w-6" />
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => onSort(col.key)}
            className={`${col.width} text-left cursor-pointer hover:text-(--text-primary) transition-colors`}
          >
            {col.label}
            {sortIndicator(col.key)}
          </button>
        ))}
        <div className="w-16 text-left">등급</div>
      </div>

      <div className="divide-y divide-(--border)">
        {sorted.length === 0 && (
          <div className="px-4 py-6 text-sm text-(--text-secondary) text-center">
            채점 가능한 프로젝트가 없습니다.
          </div>
        )}
        {sorted.map((score) => {
          const isExpanded = expandedId === score.project;
          return (
            <div key={score.project}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : score.project)}
                className="flex items-center px-4 py-2.5 w-full text-left hover:bg-(--badge-bg) transition-colors cursor-pointer"
              >
                <div className="w-6 text-(--text-secondary) text-xs">{isExpanded ? "▾" : "▸"}</div>
                <div className="flex-1 text-sm text-(--text-primary) truncate">
                  {score.projectName}
                </div>
                <div className="w-20 text-sm font-semibold text-(--text-primary)">
                  {score.score}
                </div>
                <div className="w-24 text-xs text-(--text-secondary)">
                  {score.breakdown.claudeMd}/25
                </div>
                <div className="w-20 text-xs text-(--text-secondary)">
                  {score.breakdown.settings}/25
                </div>
                <div className="w-20 text-xs text-(--text-secondary)">
                  {score.breakdown.extensions}/25
                </div>
                <div className="w-20 text-xs text-(--text-secondary)">{score.breakdown.mcp}/25</div>
                <div className="w-16">{gradeBadge(score.grade)}</div>
              </button>

              {isExpanded && (
                <div className="px-10 pb-4 bg-(--badge-bg)">
                  <div className="text-xs text-(--text-secondary) mb-2 break-all">
                    경로: {score.resolvedPath}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {score.badges.map((badge) => (
                      <span
                        key={badge.id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${
                          badge.achieved
                            ? "border-green-500/50 text-green-400"
                            : "border-(--border) text-(--text-secondary) opacity-60"
                        }`}
                      >
                        <span>{badge.achieved ? "✓" : "✗"}</span>
                        <span>{badge.label}</span>
                        {badge.detail && <span className="opacity-70">· {badge.detail}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <div className="border-t border-(--border)">
          <button
            onClick={() => setShowMissing((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-2 text-xs text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--badge-bg) transition-colors cursor-pointer"
          >
            <span>{showMissing ? "▾" : "▸"}</span>
            <span>채점 불가 ({missing.length}개) — 디렉토리 없음</span>
          </button>
          {showMissing && (
            <div className="divide-y divide-(--border)">
              {missing.map((m) => (
                <div
                  key={m.project}
                  className="px-10 py-2 text-xs text-(--text-secondary) break-all"
                >
                  <div className="text-(--text-primary) font-medium">{m.projectName}</div>
                  <div className="opacity-70">{m.resolvedPath}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
