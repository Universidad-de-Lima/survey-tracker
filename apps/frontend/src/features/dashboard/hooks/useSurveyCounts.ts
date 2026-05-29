import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchSurveyCounts, resetSurveyCounts } from '@/features/dashboard/services/dashboardService';
import type { DashboardCounts, ResetCountsResponse } from '@/features/dashboard/types';

const POLL_INTERVAL_MS = 5000;

export function useSurveyCounts() {
  return useQuery<DashboardCounts, Error>({
    queryKey: ['surveyCounts'],
    queryFn: fetchSurveyCounts,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
    retry: 2,
  });
}

export function useResetCounts() {
  const queryClient = useQueryClient();

  return useMutation<ResetCountsResponse, Error, string>({
    mutationFn: (apiKey: string) => resetSurveyCounts(apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveyCounts'] });
    },
  });
}
