import type { HarnessRawConfig, HarnessScore } from "@/shared/types/harness";
import { scoreHarnessAll } from "@/shared/utils/harnessScorer";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

async function fetchHarness(paths: string[]): Promise<HarnessRawConfig[]> {
  if (paths.length === 0) return [];
  return window.electronAPI.getHarnessConfigs(paths);
}

export function useHarnessData(projectPaths: string[]) {
  const key = useMemo(() => [...projectPaths].sort(), [projectPaths]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["harness", key],
    queryFn: () => fetchHarness(key),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    enabled: key.length > 0,
    retry: 1,
  });

  const scores: HarnessScore[] = useMemo(() => (data ? scoreHarnessAll(data) : []), [data]);

  return {
    data: scores,
    loading: isLoading,
    error: error ? "하네스 구성을 읽는 중 오류가 발생했습니다." : null,
    retry: refetch,
  };
}
