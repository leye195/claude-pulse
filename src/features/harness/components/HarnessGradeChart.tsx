import type { HarnessGrade, HarnessScore } from "@/shared/types/harness";
import { HARNESS_GRADE_COLORS } from "@/shared/utils/harnessScorer";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface HarnessGradeChartProps {
  scores: HarnessScore[];
}

const GRADES: HarnessGrade[] = ["S", "A", "B", "C", "D"];

export function HarnessGradeChart({ scores }: HarnessGradeChartProps) {
  const distribution = useMemo(() => {
    const scored = scores.filter((s) => s.exists);
    const total = scored.length;
    return GRADES.map((grade) => {
      const count = scored.filter((s) => s.grade === grade).length;
      const percentage = total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
      return { name: grade, count, percentage };
    });
  }, [scores]);

  const nonZero = distribution.filter((d) => d.count > 0);

  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg p-5">
      <span className="text-sm font-semibold text-(--text-primary) block mb-4">등급 분포</span>

      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={nonZero.length > 0 ? nonZero : [{ name: "-", count: 1 }]}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
            >
              {(nonZero.length > 0 ? nonZero : [{ name: "-" }]).map((d) => (
                <Cell
                  key={d.name}
                  fill={
                    d.name in HARNESS_GRADE_COLORS
                      ? HARNESS_GRADE_COLORS[d.name as HarnessGrade]
                      : "var(--border)"
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              formatter={(value, name) => [`${value} 프로젝트`, `${name}등급`]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {distribution.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: HARNESS_GRADE_COLORS[d.name] }}
              />
              <span className="text-sm text-(--text-primary) font-semibold">{d.name}</span>
              <span className="text-xs text-(--text-secondary)">
                {d.count}개 ({d.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
