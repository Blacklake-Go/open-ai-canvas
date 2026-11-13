import catalogs from "./locales/model-display.json";
import type { AppLocale } from "@/i18n/locales";
export const MODEL_NAMESPACE = "supdance-models";
export const MODEL_CATALOGS: Record<AppLocale, Record<string, string>> = catalogs;
