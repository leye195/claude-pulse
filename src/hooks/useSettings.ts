import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { DEFAULT_SETTINGS, type AppSettings, type DeepPartial } from "../types/settings";

const QUERY_KEY = ["settings"] as const;

export function useSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => window.electronAPI.getSettings(),
    staleTime: Infinity,
  });

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSettingsUpdated((next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    });
    return unsubscribe;
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: (partial: DeepPartial<AppSettings>) =>
      window.electronAPI.updateSettings(partial),
    onSuccess: (next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    },
  });

  return {
    settings: data ?? DEFAULT_SETTINGS,
    loading: isLoading,
    update: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
