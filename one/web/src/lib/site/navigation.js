import { getLocaleConfig } from '../locales.js';
import { LOCALIZED_PATHS, PREFIX_AGNOSTIC_BASES } from '../routePolicy.js';

export function getNavigationHref(value) {
  const href = typeof value === 'string' ? value.trim() : '';
  if (!href || /[\\\u0000-\u001f\u007f]/.test(href)) return '';
  if (/^\/(?!\/)/.test(href)) return href;
  if (!/^https?:\/\//i.test(href)) return '';
  try {
    return new URL(href).hostname ? href : '';
  } catch {
    return '';
  }
}

export function localizeNavHref(href, locale) {
  const { rootPath } = getLocaleConfig(locale);
  if (!rootPath || !href.startsWith('/')) return href;
  const base = href.split(/[/?#]/)[1];
  if (PREFIX_AGNOSTIC_BASES.includes(base) || LOCALIZED_PATHS[rootPath]?.includes(base)) {
    return `${rootPath}${href}`;
  }
  return href;
}

export function projectManagedNavigation(navigation, categories, copy, locale) {
  const isChinese = locale.startsWith('zh');
  const items = (navigation || []).flatMap((item) => {
    const href = getNavigationHref(item?.href || item?.path);
    if (!item?.enabled || !href) return [];
    const label = (isChinese ? item.label : item.labelEn) || item.labelEn || item.label;
    if (!label) return [];
    return [{ ...item, label, href: localizeNavHref(href, locale) }];
  });
  const community = items.find((item) => item.id === 'nav_community');
  const about = items.find((item) => item.id === 'nav_about');

  return {
    categories: categories.flatMap((category) => {
      if (category.id !== 'community') return [category];
      if (!community) return [];
      if (community.href !== category.href || community.target === '_blank') {
        return [{ ...category, ...community, id: category.id, features: [], models: [] }];
      }
      return [{ ...category, label: locale === 'en' || locale === 'zh-CN' ? community.label : category.label }];
    }),
    shortcuts: items.filter((item) => item !== about && item !== community),
    about: about && { ...about, label: locale === 'en' || locale === 'zh-CN' ? about.label : copy.about || about.label },
  };
}
