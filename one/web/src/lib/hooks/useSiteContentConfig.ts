import { useQuery } from '@tanstack/react-query';
import { oneApi } from '@/services/api/http';

export const siteContentQueryKey = ['site-content-config'] as const;
export const siteContentUpdateKey = 'site-content-config-updated';

export function useSiteContentConfig() {
  return useQuery({
    queryKey: siteContentQueryKey,
    queryFn: ({ signal }) => oneApi.getContentConfig(signal),
    refetchOnWindowFocus: true,
  });
}
