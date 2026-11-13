import { AREA_CATALOGS } from "./areas";
import { deDE } from "./messages/de-DE";
import { enUS } from "./messages/en-US";
import { frFR } from "./messages/fr-FR";
import { jaJP } from "./messages/ja-JP";
import { koKR } from "./messages/ko-KR";
import { zhCN } from "./messages/zh-CN";
import zhTW from "./messages/zh-TW.json";
import esES from "./messages/es-ES.json";
import type { AppLocale } from "./locales";
import interfaceCatalogs from "./messages/interface.json";
import { toI18nextTemplate } from "./interpolation";

import { flattenCatalog } from "./catalog-utils";
export { flattenCatalog, expandCatalog } from "./catalog-utils";

const core = { "zh-CN": zhCN, "en-US": enUS, "fr-FR": frFR, "de-DE": deDE, "ja-JP": jaJP, "ko-KR": koKR };
type BaseLocale = keyof typeof core;
const baseCatalogs = Object.fromEntries(Object.entries(core).map(([code, catalog]) => [code, flattenCatalog({ ...catalog, ...Object.fromEntries(Object.entries(AREA_CATALOGS).map(([area, catalogs]) => [area, catalogs[code as BaseLocale]])) })])) as Record<
    BaseLocale,
    Record<string, string>
>;
export const NATIVE_CATALOGS: Record<AppLocale, Record<string, string>> = {
    ...baseCatalogs,
    "zh-TW": zhTW,
    "es-ES": esES,
};
for (const code of Object.keys(NATIVE_CATALOGS) as AppLocale[]) {
    Object.assign(NATIVE_CATALOGS[code], Object.fromEntries(Object.entries(interfaceCatalogs[code]).map(([key, text]) => [key, toI18nextTemplate(text)])));
}
