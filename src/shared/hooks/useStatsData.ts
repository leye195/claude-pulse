import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { StatsData } from "@/shared/types/stats";

async function fetchStats(): Promise<StatsData | null> {
  return window.electronAPI.getStatsData();
}

export function useStatsData() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, status } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Listen for IPC push updates (on window focus from Electron main)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStatsUpdated((newData) => {
      queryClient.setQueryData(["stats"], newData);
    });
    return unsubscribe;
  }, [queryClient]);

  return {
    data: data ?? null,
    loading: isLoading,
    error: error
      ? "데이터를 읽는 중 오류가 발생했습니다."
      : data === null && !isLoading
        ? "Claude Code 사용 데이터가 없습니다. ~/.claude/stats-cache.json 파일을 찾을 수 없습니다."
        : null,
    retry: refetch,
    status,
  };
}
