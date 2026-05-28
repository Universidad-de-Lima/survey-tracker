import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '@/app/layouts/MainLayout';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 5000,
      retry: 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <DashboardPage />
      </MainLayout>
    </QueryClientProvider>
  );
}
