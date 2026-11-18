import type { FeaturedCase } from "./api";

export function sortFeatured(items: readonly FeaturedCase[]) {
    return [...items.filter((item) => item.pinned), ...items.filter((item) => !item.pinned)];
}

export function moveFeatured(items: readonly FeaturedCase[], from: string, to: string) {
    const source = items.findIndex((item) => item.id === from);
    const target = items.findIndex((item) => item.id === to);
    if (source < 0 || target < 0 || source === target || items[source].pinned !== items[target].pinned) return [...items];
    const ordered = [...items];
    const [item] = ordered.splice(source, 1);
    ordered.splice(target, 0, item);
    return ordered;
}

export function pinFeatured(items: readonly FeaturedCase[], id: string) {
    const target = items.find((item) => item.id === id);
    if (!target) return [...items];
    const remaining = items.filter((item) => item.id !== id);
    return sortFeatured([{ ...target, pinned: !target.pinned }, ...remaining]);
}

export function prioritizeFeatured<T>(items: readonly T[], featured: readonly FeaturedCase[], idOf: (item: T) => string): T[] {
    const ranked = new Map(featured.map(({ id }, index) => [id, index]));
    return [...items].sort((a, b) => (ranked.get(idOf(a)) ?? ranked.size) - (ranked.get(idOf(b)) ?? ranked.size));
}

export function moveGalleryItem(ids: readonly string[], id: string, position: number): string[] {
    const current = ids.indexOf(id);
    if (current < 0 || !Number.isInteger(position) || position < 1 || position > ids.length || position === current + 1) return [...ids];
    const next = [...ids];
    next.splice(current, 1);
    next.splice(position - 1, 0, id);
    return next;
}

export function entriesInGalleryOrder<T>(items: readonly T[], order: readonly string[], idOf: (item: T) => string): T[] {
    const byId = new Map(items.map((item) => [idOf(item), item]));
    return order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
