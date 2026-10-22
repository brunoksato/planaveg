import { QueryClient } from "@tanstack/react-query";

import { shouldRetryQuery } from "@sinaveg/web-contracts";

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: shouldRetryQuery, staleTime: 5 * 60 * 1000 },
    },
  });
}
