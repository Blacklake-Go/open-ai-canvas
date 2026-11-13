import zhTW from "./messages/zh-TW.json";
import esES from "./messages/es-ES.json";
import { expandCatalog } from "./catalog-utils";

export function additionalAreaCatalogs(area: string) {
    const extract = (catalog: Record<string, string>) =>
        expandCatalog(
            Object.fromEntries(
                Object.entries(catalog)
                    .filter(([key]) => key.startsWith(`${area}.`))
                    .map(([key, value]) => [key.slice(area.length + 1), value]),
            ),
        );
    return { "zh-TW": extract(zhTW), "es-ES": extract(esES) };
}
