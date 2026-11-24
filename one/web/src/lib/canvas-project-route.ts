import { localizeStudioPath } from '@/lib/locales';

export const canvasProjectParam = 'canvasProject';

export function canvasProjectHref(id: string, locale: string) {
  return localizeStudioPath(`/assets?${new URLSearchParams({ [canvasProjectParam]: id })}`, locale);
}
