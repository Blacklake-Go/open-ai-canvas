import { http } from "@/services/api/request";
import type { EmailCenterOverview, EmailEditRequest, EmailPreview, EmailCampaign } from "./types";
const base = "/admin/email-center";
export const fetchEmailCenter = (signal?: AbortSignal) => http.get<EmailCenterOverview>(`${base}/overview`, { signal });
export const initializeEmailCenter = () => http.post(`${base}/initialize`, {});
export const editEmailTemplate = (key: string, action: "draft" | "publish" | "test", request: EmailEditRequest) => http.post(`${base}/templates/${encodeURIComponent(key)}/${action}`, request);
export const previewEmailTemplate = (key: string, request: EmailEditRequest, signal?: AbortSignal) => http.post<EmailPreview>(`${base}/templates/${encodeURIComponent(key)}/preview`, request, { signal });
export const listEmailCampaigns = () => http.get<EmailCampaign[]>(`${base}/campaigns`);
export const createEmailCampaign = (request: { name: string; templateKey: string; variables: Record<string, string>; sourceFilter: string }) => http.post(`${base}/campaigns`, request);
export const controlEmailCampaign = (id: string, action: "schedule" | "pause" | "cancel", scheduleAt?: string) => http.post(`${base}/campaigns/${encodeURIComponent(id)}/${action}`, { scheduleAt });
export const uploadEmailAsset = (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return http.post<{ url: string }>(`${base}/assets`, body);
};
export const getEmailPreference = () => http.get<{ marketing: boolean }>("/auth/email-center/preference");
export const setEmailPreference = (marketing: boolean) => http.put("/auth/email-center/preference", { marketing });
export const listEmailActivity = () => http.get<{ id: string; action: string; targetId: string; createdAt: string }[]>(`${base}/activity`);
export const listEmailQueue = () => http.get<{ id: string; campaignId: string; recipient: string; status: string; attempts: number; nextAttemptAt: string; updatedAt: string }[]>(`${base}/queue`);
