import { apiRequest } from './http';

interface CanvasProject {
  id: string;
  ownerUserId: string;
  name: string;
  thumbnailAssetId?: string | null;
  snapshot: { nodes?: unknown[]; connections?: unknown[] };
  version: number;
  createdAt: string;
  updatedAt: string;
}

export async function readCanvasProject(id: string, owner: string, signal: AbortSignal) {
  const { project } = await apiRequest<{ project: CanvasProject }>(`/api/canvas/projects/${encodeURIComponent(id)}`, {
    cache: 'no-store', headers: { 'X-ONE-Expected-User': owner }, signal,
  });
  return project;
}
