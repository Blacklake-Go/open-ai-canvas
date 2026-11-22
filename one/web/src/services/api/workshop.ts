import { apiRequest } from './http';

export interface WorkshopProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface WorkshopDraft {
  title: string;
  story: string;
}

export interface WorkshopProject extends WorkshopProjectSummary, WorkshopDraft {
  revision: number;
}

interface WorkshopProjectPage {
  projects: WorkshopProjectSummary[];
  pageSize: number;
  hasMore: boolean;
}

const projectsPath = '/api/workshop/projects';
const projectPath = (id: string) => `${projectsPath}/${encodeURIComponent(id)}`;
const ownerHeader = (owner: string) => ({ 'X-ONE-Expected-User': owner });

export const workshopApi = {
  list(owner: string, offset: number, signal: AbortSignal) {
    return apiRequest<WorkshopProjectPage>(`${projectsPath}?offset=${offset}`, {
      headers: ownerHeader(owner),
      signal,
    });
  },
  get(owner: string, id: string, signal: AbortSignal) {
    return apiRequest<WorkshopProject>(projectPath(id), { headers: ownerHeader(owner), signal });
  },
  create(owner: string, draft: WorkshopDraft, creationKey: string) {
    return apiRequest<WorkshopProject>(projectsPath, {
      method: 'POST', headers: ownerHeader(owner), body: { ...draft, creationKey },
    });
  },
  update(owner: string, id: string, revision: number, draft: WorkshopDraft) {
    return apiRequest<WorkshopProject>(projectPath(id), {
      method: 'PUT', headers: ownerHeader(owner), body: { ...draft, revision },
    });
  },
};
