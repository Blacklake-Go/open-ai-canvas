import { afterEach, expect, spyOn, test } from "bun:test";
import { http } from "../src/services/api/request";
import { getPublicSupDanceI18nBundle, upsertAdminSupDanceI18nEntries } from "../src/supdance/plugins/i18n/api";
const restores: Array<() => void> = [];
afterEach(() => restores.splice(0).forEach((restore) => restore()));

test("a bundle read started before a successful admin write cannot overwrite the publication", async () => {
    let resolveRead!: (value: unknown) => void;
    const get = spyOn(http, "get").mockImplementation(
        () =>
            new Promise((resolve) => {
                resolveRead = resolve as typeof resolveRead;
            }),
    );
    const put = spyOn(http, "put").mockResolvedValue({ updatedCount: 1 });
    restores.push(
        () => get.mockRestore(),
        () => put.mockRestore(),
    );
    const pending = getPublicSupDanceI18nBundle();
    await upsertAdminSupDanceI18nEntries([]);
    resolveRead({ revision: "stale" });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

test("an admin HTTP failure propagates and never becomes a local publication", async () => {
    const put = spyOn(http, "put").mockRejectedValue(new Error("server rejected the translation"));
    restores.push(() => put.mockRestore());
    await expect(upsertAdminSupDanceI18nEntries([])).rejects.toThrow("server rejected the translation");
});
