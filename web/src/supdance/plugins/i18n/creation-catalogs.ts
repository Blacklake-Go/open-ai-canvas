import { CREATION_UI_SOURCES } from "./locales/creation-sources";
import enUS from "./locales/creation/en-US";
import jaJP from "./locales/creation/ja-JP";
import koKR from "./locales/creation/ko-KR";
import frFR from "./locales/creation/fr-FR";
import deDE from "./locales/creation/de-DE";
import zhTW from "./locales/creation/zh-TW.json";
import esES from "./locales/creation/es-ES.json";
import type { AppLocale } from "@/i18n/locales";

export const CREATION_NAMESPACE = "supdance-creation";
export const CREATION_CATALOGS: Record<AppLocale, Record<string, string>> = {
    "zh-CN": CREATION_UI_SOURCES,
    "en-US": enUS,
    "ja-JP": jaJP,
    "ko-KR": koKR,
    "fr-FR": frFR,
    "de-DE": deDE,
    "zh-TW": zhTW,
    "es-ES": esES,
};
