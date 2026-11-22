'use client';

import { useState, useEffect, createContext, useContext, useMemo, createElement } from 'react';

export const DEFAULT_BRAND = {
  brandName: 'supdance',
  siteTitle: 'SupDance — Free AI Image & Video Studio',
  titleTemplate: '%s | SupDance AI Studio',
  brandSlogan: 'AI 创意工作室',
  logoType: 'image',
  logoUrl: '/uploads/branding/logo-1789960604256-8d69f211113d.png',
  logoIcon: 'layers',
  logoBgColor: '#22d3ee',
  logoTextColor: '#000000',
  logoHref: '/',
  logoTarget: '_self',
  showBrandName: false,
  faviconUrl: '/uploads/branding/icon-1790631358168-d0b66b0fc4e1.svg',
};

export const DEFAULT_NAVIGATION = [
  {
    id: 'nav_community',
    label: '即梦社区',
    labelEn: 'Community',
    href: '/community',
    icon: 'flame',
    iconColor: '#fb923c',
    style: 'gradient',
    badge: 'HOT',
    enabled: true,
    target: '_self',
    order: 1,
  },
  {
    id: 'nav_creations',
    label: '我的作品',
    labelEn: 'My Creations',
    href: '/creations',
    icon: 'folder',
    iconColor: '#facc15',
    style: 'subtle',
    badge: '',
    enabled: true,
    target: '_self',
    order: 2,
  },
  {
    id: 'nav_pricing',
    label: '商用定价',
    labelEn: 'Pricing',
    href: '/pricing',
    icon: 'zap',
    iconColor: '#e11d74',
    style: 'subtle',
    badge: 'PRO',
    enabled: true,
    target: '_self',
    order: 3,
  },
  {
    id: 'nav_call_api',
    label: '开放平台',
    labelEn: 'API',
    href: '/call-api',
    icon: 'workflow',
    iconColor: '#a855f7',
    style: 'subtle',
    badge: '筹备中',
    enabled: true,
    target: '_self',
    order: 4,
  },
  {
    id: 'nav_about',
    label: '关于本站',
    labelEn: 'About',
    href: '/about',
    icon: 'sparkles',
    iconColor: '#38bdf8',
    style: 'subtle',
    badge: '',
    enabled: true,
    target: '_self',
    order: 999,
  },
];

let cachedBranding = null;
let fetchPromise = null;
let brandingRevision = 0;

const BRANDING_UPDATED_EVENT = 'site-branding-updated';
const BRANDING_STORAGE_KEY = 'site-branding-updated';
const BRANDING_PAYLOAD_KEY = 'site-branding-payload-v2';

function normalizeBranding(data) {
  if (!data?.brand) return null;
  return {
    brand: { ...DEFAULT_BRAND, ...data.brand },
    navigation: Array.isArray(data.navigation) ? data.navigation : DEFAULT_NAVIGATION,
  };
}

// 客户端初始化时，尝试从本地缓存恢复，确保刷新即刻拥有最新配置，杜绝白屏与默认图标闪屏
if (typeof window !== 'undefined' && !cachedBranding) {
  try {
    const raw = window.localStorage.getItem(BRANDING_PAYLOAD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.brand) {
        cachedBranding = {
          brand: { ...DEFAULT_BRAND, ...parsed.brand },
          navigation: Array.isArray(parsed.navigation) ? parsed.navigation : DEFAULT_NAVIGATION,
        };
      }
    }
  } catch {}
}

function cacheBranding(data) {
  const normalized = normalizeBranding(data);
  if (!normalized) return cachedBranding;
  brandingRevision += 1;
  fetchPromise = null;
  cachedBranding = normalized;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BRANDING_PAYLOAD_KEY, JSON.stringify(normalized));
    } catch {}
  }
  return cachedBranding;
}

function fetchBranding() {
  if (fetchPromise) return fetchPromise;

  const revision = brandingRevision;
  const request = fetch('/api/site/branding', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (revision === brandingRevision) {
        const normalized = normalizeBranding(data);
        if (normalized) {
          cacheBranding(normalized);
        }
      }
      return cachedBranding;
    })
    .catch(() => cachedBranding)
    .finally(() => {
      if (fetchPromise === request) fetchPromise = null;
    });

  fetchPromise = request;
  return request;
}

export function publishBrandingUpdate(brand, navigation) {
  const updated = cacheBranding({ brand, navigation });
  if (!updated || typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: updated }));

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(BRANDING_UPDATED_EVENT);
    channel.postMessage(updated);
    channel.close();
  }

  try {
    window.localStorage.setItem(BRANDING_STORAGE_KEY, String(Date.now()));
  } catch {
    // BroadcastChannel and same-tab events still work when storage is unavailable.
  }
}

const BrandingContext = createContext(null);

export function BrandingProvider({ initialBrand = null, initialNav = null, children }) {
  const initialData = useMemo(() => {
    if (initialBrand) {
      const norm = normalizeBranding({ brand: initialBrand, navigation: initialNav });
      if (norm) {
        cachedBranding = norm;
        return norm;
      }
    }
    return cachedBranding || { brand: DEFAULT_BRAND, navigation: DEFAULT_NAVIGATION };
  }, [initialBrand, initialNav]);

  const [brand, setBrand] = useState(initialData.brand);
  const [navigation, setNavigation] = useState(initialData.navigation);
  const [isLoading, setIsLoading] = useState(!cachedBranding && !initialBrand);

  useEffect(() => {
    let isMounted = true;

    const applyUpdate = (result) => {
      if (isMounted && result?.brand && result?.navigation) {
        setBrand(result.brand);
        setNavigation(result.navigation);
        setIsLoading(false);
      }
    };

    const handleBrandingEvent = (event) => {
      const result = cacheBranding(event.detail);
      applyUpdate(result);
    };
    const handleStorage = (event) => {
      if (event.key === BRANDING_STORAGE_KEY || event.key === BRANDING_PAYLOAD_KEY) {
        fetchBranding().then(applyUpdate);
      }
    };
    const handleFocus = () => fetchBranding().then(applyUpdate);

    window.addEventListener(BRANDING_UPDATED_EVENT, handleBrandingEvent);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);

    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(BRANDING_UPDATED_EVENT);
      channel.onmessage = (event) => applyUpdate(cacheBranding(event.data));
    }

    if (cachedBranding) {
      applyUpdate(cachedBranding);
    } else {
      fetchBranding().then(applyUpdate);
    }

    return () => {
      isMounted = false;
      window.removeEventListener(BRANDING_UPDATED_EVENT, handleBrandingEvent);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      channel?.close();
    };
  }, []);

  const value = useMemo(() => ({ brand, navigation, isLoading }), [brand, navigation, isLoading]);

  return createElement(BrandingContext.Provider, { value }, children);
}

function useFallbackBranding(enabled) {
  const [brand, setBrand] = useState(cachedBranding?.brand || DEFAULT_BRAND);
  const [navigation, setNavigation] = useState(cachedBranding?.navigation || DEFAULT_NAVIGATION);
  const [isLoading, setIsLoading] = useState(!cachedBranding);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const applyUpdate = (result) => {
      if (isMounted && result?.brand && result?.navigation) {
        setBrand(result.brand);
        setNavigation(result.navigation);
        setIsLoading(false);
      }
    };

    const handleBrandingEvent = (event) => {
      const result = cacheBranding(event.detail);
      applyUpdate(result);
    };
    const handleStorage = (event) => {
      if (event.key === BRANDING_STORAGE_KEY || event.key === BRANDING_PAYLOAD_KEY) {
        fetchBranding().then(applyUpdate);
      }
    };
    const handleFocus = () => fetchBranding().then(applyUpdate);

    window.addEventListener(BRANDING_UPDATED_EVENT, handleBrandingEvent);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);

    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(BRANDING_UPDATED_EVENT);
      channel.onmessage = (event) => applyUpdate(cacheBranding(event.data));
    }

    if (cachedBranding) {
      applyUpdate(cachedBranding);
    } else {
      fetchBranding().then(applyUpdate);
    }

    return () => {
      isMounted = false;
      window.removeEventListener(BRANDING_UPDATED_EVENT, handleBrandingEvent);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      channel?.close();
    };
  }, [enabled]);

  return {
    brand,
    navigation,
    isLoading,
  };
}

export function useBranding() {
  const context = useContext(BrandingContext);
  const fallback = useFallbackBranding(!context);
  return context || fallback;
}
