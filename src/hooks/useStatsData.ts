import { useState, useEffect } from "react";
import type { StatsData } from "../types/stats";

interface UseStatsDataResult {
  data: StatsData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useStatsData(): UseStatsDataResult {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getStatsData();
      if (result === null) {
        setError("Claude Code 사용 데이터가 없습니다. ~/.claude/stats-cache.json 파일을 찾을 수 없습니다.");
      } else {
        setData(result);
      }
    } catch {
      setError("데이터를 읽는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const unsubscribe = window.electronAPI.onStatsUpdated((newData) => {
      setData(newData);
      setError(null);
    });

    return unsubscribe;
  }, []);

  return { data, loading, error, retry: fetchData };
}
