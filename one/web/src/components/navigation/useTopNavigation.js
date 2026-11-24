import { useQuery } from '@tanstack/react-query';
import { getMegaNavCategories, getMegaNavCopy } from '@/config/mega-navigation';
import { getCommonCopy, getLocaleConfig } from '@/lib/locales';
import { useBranding } from '@/lib/hooks/useBranding';
import { localizeNavHref, projectManagedNavigation } from '@/lib/site/navigation';
import { withPublicNavigationModels } from '@/lib/modelCenter/megaNavigationModels';

async function fetchDirectory({ signal }) {
  const response = await fetch('/api/models/active', { signal });
  if (!response.ok) throw new Error('Model directory unavailable');
  const payload = await response.json();
  return {
    restricted: payload.launchScope?.restricted === true,
    models: Array.isArray(payload.models) ? payload.models : [],
  };
}

export function useTopNavigation(locale) {
  const rootPath = getLocaleConfig(locale).rootPath;
  const { navigation } = useBranding();
  const { data } = useQuery({
    queryKey: ['top-navigation-model-directory'],
    queryFn: fetchDirectory,
    staleTime: 60_000,
    retry: false,
  });
  const copy = getCommonCopy(locale);
  const menuCopy = getMegaNavCopy(locale);
  const categories = withPublicNavigationModels(getMegaNavCategories(locale), data?.models, rootPath);
  const managed = projectManagedNavigation(navigation, categories, copy.topNav, locale);

  return {
    copy,
    menuCopy,
    homeHref: locale === 'zh-CN' ? '/' : (rootPath || '/'),
    assetsHref: localizeNavHref('/assets', locale),
    restricted: data?.restricted === true,
    categories: data?.restricted ? managed.categories.filter((category) => category.id === 'images' && category.models.length).map((category) => ({ ...category, features: [], models: [] })) : managed.categories,
    shortcuts: managed.shortcuts,
    about: managed.about,
  };
}
