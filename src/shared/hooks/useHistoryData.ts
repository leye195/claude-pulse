import type { HistoryEntry } from "@/shared/types/history";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

async function fetchHistory(): Promise<HistoryEntry[] | null> {
  return window.electronAPI.getHistoryData();
}

export function useHistoryData() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  useEffect(() => {
    const unsubscribe = window.electronAPI.onHistoryUpdated((newData) => {
      queryClient.setQueryData(["history"], newData);
    });
    return unsubscribe;
  }, [queryClient]);

  return {
    data: data ?? null,
    loading: isLoading,
    error: error
      ? "히스토리 데이터를 읽는 중 오류가 발생했습니다."
      : data === null && !isLoading
        ? "프롬프트 히스토리가 없습니다. ~/.claude/history.jsonl 파일을 찾을 수 없습니다."
        : null,
    retry: refetch,
  };
}
