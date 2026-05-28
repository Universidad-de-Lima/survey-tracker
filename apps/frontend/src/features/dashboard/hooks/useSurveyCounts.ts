import { useQuery } from '@tanstack/react-query';

import { fetchSurveyCounts } from '@/features/dashboard/services/dashboardService';
import type { DashboardCounts } from '@/features/dashboard/types';

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
