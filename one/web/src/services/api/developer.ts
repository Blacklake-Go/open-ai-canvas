import { apiRequest } from './http';

export interface DeveloperKeyInfo {
  id: string;
  suffix: string;
  createdAt: string;
}

const path = '/api/user/api-key';

export const developerKeys = {
  read(owner: string, signal: AbortSignal) {
    return apiRequest<{ keyInfo: DeveloperKeyInfo | null }>(path, {
      contract: 'success',
      cache: 'no-store',
      headers: { 'X-ONE-Expected-User': owner },
      signal,
    });
  },
  issue(owner: string, previousKeyId: string | undefined, signal: AbortSignal) {
    return apiRequest<{ keyInfo: DeveloperKeyInfo; apiKey: string }>(path, {
      method: 'POST',
      contract: 'success',
      headers: { 'X-ONE-Expected-User': owner },
      body: { previousKeyId },
      signal,
    });
  },
  revoke(owner: string, previousKeyId: string, signal: AbortSignal) {
    return apiRequest<{ keyInfo: null }>(path, {
      method: 'DELETE',
      contract: 'success',
      headers: { 'X-ONE-Expected-User': owner },
      body: { previousKeyId },
      signal,
    });
  },
};
