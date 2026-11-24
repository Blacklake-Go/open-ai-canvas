import { apiRequest } from "@/services/api/http";

export const workflowBase = "/api/one/workflows";

export function workflowRequest(owner, path = "", options = {}) {
  const { headers, ...rest } = options;
  return apiRequest(workflowBase + path, {
    cache: "no-store", ...rest,
    headers: { ...headers, "X-ONE-Expected-User": String(owner) },
  });
}

export function workflowError(error, copy) {
  switch (error?.code) {
    case "WORKFLOW_CONFLICT":
      return copy.conflict;
    case "WORKFLOW_MODEL_UNAVAILABLE":
      return copy.modelMissing;
    case "WORKFLOW_STEP_BLOCKED":
      return copy.waiting;
    case "INSUFFICIENT_CREDITS":
      return copy.creditError;
    case "WORKFLOW_NOT_FOUND":
      return copy.unavailable;
    case "CONTENT_POLICY_VIOLATION":
    case "QUOTE_MISMATCH":
      return error.message;
    default:
      return copy.failed;
  }
}
