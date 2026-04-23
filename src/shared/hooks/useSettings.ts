import { DEFAULT_SETTINGS, type AppSettings, type DeepPartial } from "@/shared/types/settings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const QUERY_KEY = ["settings"] as const;

export function useSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<AppSettings>({
    queryKey: QUERY_KEY,
    queryFn: () => window.electronAPI.getSettings(),
    staleTime: Infinity,
  });

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSettingsUpdated((next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    });
    // Reconcile any push that fired between queryFn resolution and subscribe.
    refetch();
    return unsubscribe;
  }, [queryClient, refetch]);

  const mutation = useMutation({
    mutationFn: (partial: DeepPartial<AppSettings>) => window.electronAPI.updateSettings(partial),
    onSuccess: (next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    },
  });

  return {
    settings: data ?? DEFAULT_SETTINGS,
    loading: isLoading,
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
