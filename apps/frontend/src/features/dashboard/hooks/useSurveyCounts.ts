import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchSurveyCounts, resetSurveyCounts } from '@/features/dashboard/services/dashboardService';
import type { DashboardCounts, ResetCountsResponse } from '@/features/dashboard/types';

// 2 segundos: el panel se proyecta mientras el salón entero escanea y termina, así
// que el avance tiene que verse casi al instante.
const POLL_INTERVAL_MS = 2000;

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

  return useMutation<ResetCountsResponse, Error, void>({
    mutationFn: resetSurveyCounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveyCounts'] });
    },
  });
}
