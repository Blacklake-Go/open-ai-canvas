import { expect, test } from "bun:test";
import type { FeaturedCase } from "@/supdance/plugins/inspiration-curation/api";
import { entriesInGalleryOrder, moveFeatured, moveGalleryItem, pinFeatured, prioritizeFeatured } from "@/supdance/plugins/inspiration-curation/order";

const pinned: FeaturedCase = { id: "pinned", pinned: true, focusX: 50, focusY: 50 };
const first: FeaturedCase = { id: "first", pinned: false, focusX: 50, focusY: 50 };
const second: FeaturedCase = { ...first, id: "second" };
const items = [pinned, first, second];

test("featured positions can move within their group and pinning changes the group", () => {
    expect(moveFeatured(items, second.id, first.id)).toEqual([pinned, second, first]);
    expect(moveFeatured(items, first.id, pinned.id)).toEqual(items);
    expect(pinFeatured(items, second.id)).toEqual([{ ...second, pinned: true }, pinned, first]);
    expect(pinFeatured(items, pinned.id)).toEqual([{ ...pinned, pinned: false }, first, second]);
    expect(items).toEqual([pinned, first, second]);
});

test("released picks sort ahead of recommendations with stable order for all other cases", () => {
    const recommendations = ["other-2", first.id, "other-1", second.id];
    expect(prioritizeFeatured(recommendations, items, (id) => id)).toEqual([first.id, second.id, "other-2", "other-1"]);
    expect(prioritizeFeatured(recommendations, [], (id) => id)).toEqual(recommendations);
});

test("a public list keeps its published order after filtering and omits unlisted and unavailable cases", () => {
    const entries = ["b", "a", "c", "private"];
    expect(entriesInGalleryOrder(entries, ["c", "removed", "a", "b"], (id) => id)).toEqual(["c", "a", "b"]);
    expect(entriesInGalleryOrder(entries, [], (id) => id)).toEqual([]);
    expect(moveGalleryItem(entries, "b", 3)).toEqual(["a", "c", "b", "private"]);
    expect(moveGalleryItem(entries, "b", 0)).toEqual(entries);
});
