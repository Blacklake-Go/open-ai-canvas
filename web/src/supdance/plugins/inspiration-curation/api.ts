import { http } from "@/services/api/request";

export type StyleTerm = { id: string; label: string };
export type CaseTags = { styles: string[]; promptType?: string };
export type FeaturedCase = { id: string; pinned: boolean; title?: string; focusX: number; focusY: number };
export type CurationDocument = { styles: StyleTerm[]; cases: Record<string, CaseTags>; featured: FeaturedCase[]; galleryOrder?: string[] };
export type CurationRelease = { id: string; createdAt: string; actorId: string; restoredFrom?: string };
export type CurationState = { revision: number; draft: CurationDocument; published: string; history: CurationRelease[] };
export type CurationCard = { id: string; title: string; description: string; image: string; mode: string; source: string; credit: string; category: string; date?: string; eligible: boolean };
export const MAX_FEATURED = 12;
export const MAX_GALLERY_ORDER = 10_000;
export const PROMPT_TYPES = ["description", "shot-script", "structured", "template"] as const;
const admin = "/admin/inspiration-curation";

export const readCuration = (signal?: AbortSignal) => http.get<CurationState>(admin, { signal });
export const readCurationCatalog = (query: string, signal?: AbortSignal) => http.get<CurationCard[]>(admin + "/catalog", { params: query ? { q: query } : undefined, signal });
export const changeCuration = (action: "draft" | "publish" | "rollback", input: { expectedRevision: number; document?: CurationDocument; version?: string }) => http.post<CurationState>(admin + "/" + action, input);
export const readPublicCuration = () => http.get<CurationDocument>("/public/inspirations/curation");
