'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getUserBalance } from 'studio/muapi';
import { applyActiveModelDirectory } from 'studio/models';
import { Spinner } from 'studio/ui/feedback';
import { Button, IconButton } from 'studio/ui/button';
import { Modal, ModalContent } from 'studio/ui/overlay';
import axios from 'axios';
import AuthModal from './AuthModal';
import UserOnboardingModal from './auth/UserOnboardingModal';
import DeletionGracePeriodModal from './auth/DeletionGracePeriodModal';
import { StudioResourceBoundary } from './StudioResourceBoundary';

import StudioWorkbenchSkeleton from './studio/StudioWorkbenchSkeleton';

// Each workbench is a heavy subtree (Konva canvases, pollers, editors). Loading
// them through the `studio` barrel mounted all seventeen on every /studio visit,
// so each one is fetched as its own chunk and mounted only while it is active.
// Using StudioWorkbenchSkeleton eliminates empty-page flicker and provides seamless visual continuity.
const studioFallback = () => (
  <StudioWorkbenchSkeleton />
);
const dynamicStudio = (loader) => dynamic(loader, { ssr: false, loading: studioFallback });
const ImageStudio = dynamicStudio(() => import('studio/ImageStudio'));
const VideoStudio = dynamicStudio(() => import('studio/VideoStudio'));
const AudioStudio = dynamicStudio(() => import('studio/AudioStudio'));
const LayersStudio = dynamicStudio(() => import('studio/LayersStudio'));
const ClippingStudio = dynamicStudio(() => import('studio/ClippingStudio'));
const MotionControlStudio = dynamicStudio(() => import('studio/MotionControlStudio'));
const VibeMotionStudio = dynamicStudio(() => import('studio/VibeMotionStudio'));
const LipSyncStudio = dynamicStudio(() => import('studio/LipSyncStudio'));
const RecastStudio = dynamicStudio(() => import('studio/RecastStudio'));
const CinemaStudio = dynamicStudio(() => import('studio/CinemaStudio'));
const MarketingStudio = dynamicStudio(() => import('studio/MarketingStudio'));
const WorkflowStudio = dynamicStudio(() => import('studio/WorkflowStudio'));
const AgentStudio = dynamicStudio(() => import('studio/AgentStudio'));
const AppsStudio = dynamicStudio(() => import('studio/AppsStudio'));
const AiInfluencerStudio = dynamicStudio(() => import('studio/AiInfluencerStudio'));
const DesignAgentStudio = dynamicStudio(() => import('studio/DesignAgentStudio'));
const HeadshotStudio = dynamicStudio(() => import('./HeadshotStudio'));
import LanguageSwitcher from './LanguageSwitcher';
import UserDropdownMenu from './UserDropdownMenu';
import AccountModal from './account/AccountModal';
import UserProfileModal from './profile/UserProfileModal';
import SubscriptionModal from './subscription/SubscriptionModal';
import TopMegaNavigation from './navigation/TopMegaNavigation';
import Link from 'next/link';
import BrandLogo from './site/BrandLogo';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { SpatialBackground } from '@/components/spatial';
import { getCommonCopy, getLocaleConfig, localizeStudioPath, normalizeLocale } from '@/lib/locales';
import { STUDIO_TAB_IDS, normalizeStudioTab, inferStudioTabFromModel } from '@/lib/studio-routes';
import { FOCUS_RING } from 'studio/ui/tokens';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Flame,
  FolderOpen,
  Menu,
  PanelLeft,
  Sparkles,
  Wand2,
  Box,
  Bot,
  Compass,
  ExternalLink,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useBranding } from '@/lib/hooks/useBranding';

function DynamicVectorIcon({ iconName, color = 'currentColor', className = 'w-5 h-5' }) {
  switch (iconName) {
    case 'sparkles':
      return <Sparkles className={className} style={{ color }} />;
    case 'wand':
      return <Wand2 className={className} style={{ color }} />;
    case 'zap':
      return <Zap className={className} style={{ color }} />;
    case 'cube':
      return <Box className={className} style={{ color }} />;
    case 'layers':
    default:
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
  }
}

function DynamicNavIcon({ iconName, color, className = 'w-3.5 h-3.5' }) {
  switch (iconName) {
    case 'flame':
      return <Flame className={className} style={color ? { color } : undefined} />;
    case 'folder':
      return <FolderOpen className={className} style={color ? { color } : undefined} />;
    case 'workflow':
      return <Workflow className={className} style={color ? { color } : undefined} />;
    case 'bot':
      return <Bot className={className} style={color ? { color } : undefined} />;
    case 'zap':
      return <Zap className={className} style={color ? { color } : undefined} />;
    case 'sparkles':
      return <Sparkles className={className} style={color ? { color } : undefined} />;
    case 'compass':
      return <Compass className={className} style={color ? { color } : undefined} />;
    case 'external':
      return <ExternalLink className={className} style={color ? { color } : undefined} />;
    default:
      return null;
  }
}

// Tab/category ids, icons, and English `label` fallbacks are stable
// identifiers, not locale copy — the actual rendered label is resolved
// per-locale from `copy.tabs`/`copy.categories` via tabLabel()/categoryLabel()
// inside the component below, with these English strings as the fallback
// when a locale bundle is missing the key.
const TABS = [
  {
    id: 'image',
    label: 'Image Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    )
  },
  {
    id: 'headshot',
    label: 'AI Headshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
  {
    id: 'layers',
    label: 'Layers Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </svg>
    )
  },
  {
    id: 'video',
    label: 'Video Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    )
  },
  {
    id: 'audio',
    label: 'Audio Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    )
  },
  {
    id: 'clipping',
    label: 'AI Clipping',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <line x1="20" y1="4" x2="8.12" y2="15.88"/>
        <line x1="14.47" y1="14.47" x2="20" y2="20"/>
        <line x1="8.12" y1="8.12" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    id: 'motion-control',
    label: 'Motion Control',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3"/>
        <line x1="12" y1="8" x2="12" y2="14"/>
        <path d="M9 11l3 3 3-3"/>
        <path d="M7 21l5-5 5 5"/>
      </svg>
    )
  },
  {
    id: 'vibe-motion',
    label: 'Vibe Motion',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    )
  },
  {
    id: 'lipsync',
    label: 'Lip Sync',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    )
  },
  {
    id: 'body-swap',
    label: 'Body Swap',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="8.5" cy="7" r="4"/>
        <polyline points="17 11 19 13 23 9"/>
        <path d="M23 13v-2"/>
      </svg>
    )
  },
  {
    id: 'cinema',
    label: 'Cinema Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="2" y1="7" x2="7" y2="7"/>
        <line x1="2" y1="17" x2="7" y2="17"/>
        <line x1="17" y1="17" x2="22" y2="17"/>
        <line x1="17" y1="7" x2="22" y2="7"/>
      </svg>
    )
  },
  {
    id: 'marketing',
    label: 'Marketing Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="8" y1="9" x2="16" y2="9"/>
        <line x1="8" y1="13" x2="14" y2="13"/>
      </svg>
    )
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="6" height="6" rx="1"/>
        <rect x="15" y="3" width="6" height="6" rx="1"/>
        <rect x="9" y="15" width="6" height="6" rx="1"/>
        <path d="M6 9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9"/>
        <path d="M12 13v2"/>
      </svg>
    )
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2"/>
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v4"/>
        <line x1="8" y1="16" x2="8.01" y2="16"/>
        <line x1="16" y1="16" x2="16.01" y2="16"/>
      </svg>
    )
  },
  {
    id: 'design-agent',
    label: 'Design Agent',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <path d="M2 2l7.586 7.586"/>
        <circle cx="11" cy="11" r="2"/>
      </svg>
    )
  },
  {
    id: 'apps',
    label: 'Explore Apps',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    )
  },
  {
    id: 'ai-influencer',
    label: 'Character Designer',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    )
  }
];

const NAVIGATION_CATEGORIES = [
  {
    id: 'images',
    label: 'Images',
    tabIds: ['image', 'headshot', 'layers', 'design-agent', 'ai-influencer'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
    )
  },
  {
    id: 'video',
    label: 'Video',
    tabIds: ['video', 'cinema', 'clipping', 'motion-control', 'vibe-motion', 'lipsync', 'body-swap', 'marketing'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="15" height="16" rx="2"/>
        <path d="M17 9l5-3v12l-5-3"/>
        <path d="M8 9l4 3-4 3z"/>
      </svg>
    )
  },
  {
    id: 'audio',
    label: 'Audio',
    tabIds: ['audio'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    )
  },
  {
    id: 'agents-automation',
    label: 'Agents & Automation',
    tabIds: ['agents', 'workflows'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="6" height="6" rx="1"/>
        <rect x="15" y="3" width="6" height="6" rx="1"/>
        <rect x="9" y="15" width="6" height="6" rx="1"/>
        <path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/>
        <path d="M12 13v2"/>
      </svg>
    )
  }
];

const EXPLORE_APPS_TAB = TABS.find((tab) => tab.id === 'apps');

const getNavigationCategory = (tabId) => (
  NAVIGATION_CATEGORIES.find((category) => category.tabIds.includes(tabId))
);

const STORAGE_KEY = 'muapi_key';
const NOTIFICATIONS_STORAGE_KEY = 'open_gen_notifications_v1';
const MAX_VISIBLE_NOTIFICATIONS = 3;

const loadStoredNotifications = () => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    const now = Date.now();
    return Array.isArray(stored)
      ? stored.filter((notification) => notification.expiresAt > now).slice(0, MAX_VISIBLE_NOTIFICATIONS)
      : [];
  } catch {
    return [];
  }
};

const persistNotifications = (notifications) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(notifications),
    );
  } catch {
    // Notification persistence is optional; rendering still works without storage.
  }
};

export default function StandaloneShell({
  locale = 'en',
  initialUser = null,
  initialTab = null,
  initialModel = '',
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname() || '';
  const slug = params?.slug || [];
  const idFromParams = params?.id;
  const tabFromParams = params?.tab;
  const { brand: siteBrand, navigation: siteNavigation } = useBranding();
  const [logoImgError, setLogoImgError] = useState(false);

  useEffect(() => {
    setLogoImgError(false);
  }, [siteBrand?.logoUrl]);

  const copy = getCommonCopy(locale);
  const nativeLocaleName = getLocaleConfig(locale).nativeName;
  const tabLabel = useCallback(
    (tabId) => copy.tabs?.[tabId] || TABS.find((t) => t.id === tabId)?.label || tabId,
    [copy],
  );
  const categoryLabel = useCallback(
    (categoryId) => copy.categories?.[categoryId] || NAVIGATION_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId,
    [copy],
  );
  const studioPath = useCallback((tabId) => localizeStudioPath(locale, tabId), [locale]);

  // Helper to extract workflow details precisely from either route structure
  const getWorkflowInfo = useCallback(() => {
    if (idFromParams) {
        return { id: idFromParams, tab: tabFromParams || null };
    }
    const wfIndex = slug.findIndex(s => s === 'workflows' || s === 'workflow');
    if (wfIndex === -1) return { id: null, tab: null };
    return {
      id: slug[wfIndex + 1] || null,
      tab: slug[wfIndex + 2] || null
    };
  }, [slug, idFromParams, tabFromParams]);

  const { id: urlWorkflowId } = getWorkflowInfo();

  // Initialize activeTab from initialTab prop, URL slug/params, model inference, or default to 'image'
  const getInitialTab = () => {
    if (initialTab && (STUDIO_TAB_IDS.includes(initialTab) || normalizeStudioTab(initialTab))) {
      return normalizeStudioTab(initialTab);
    }
    if (idFromParams || slug.includes('workflow')) return 'workflows';
    if (slug.includes('agents')) return 'agents';
    if (slug.includes('design-agent')) return 'design-agent';
    if (slug.includes('apps')) return 'apps';
    const firstSegment = slug[0];
    if (firstSegment && (STUDIO_TAB_IDS.includes(firstSegment) || normalizeStudioTab(firstSegment))) {
      return normalizeStudioTab(firstSegment);
    }
    const effectiveModel = initialModel || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('model') : '');
    if (effectiveModel) {
      const inferred = inferStudioTabFromModel(effectiveModel);
      if (inferred) return inferred;
    }
    return 'image';
  };
  
  const [apiKey, setApiKey] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab());

  const [balance, setBalance] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const { user: sessionUser, credits: sessionCredits, entitlements: sessionEntitlements, mutate: mutateSession, refresh: refreshSession } = useUserSession(initialUser);
  const [accountUser, setAccountUser] = useState(initialUser ?? sessionUser);
  const [accountChecked, setAccountChecked] = useState(true);
  const [accountCredits, setAccountCredits] = useState(initialUser?.credits ?? sessionCredits);

  useEffect(() => {
    setAccountUser(sessionUser);
    setAccountCredits(sessionCredits);
  }, [sessionUser, sessionCredits]);

  const [selectedModelKey, setSelectedModelKey] = useState(initialModel || '');
  const [currentRemixPrompt, setCurrentRemixPrompt] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('prompt') || sp.get('remixPrompt') || '';
    }
    return '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const modelFromUrl = sp.get('model');
      if (modelFromUrl) {
        if (!initialModel || modelFromUrl !== selectedModelKey) {
          setSelectedModelKey(modelFromUrl);
        }
        if (!sp.get('tab')) {
          const inferred = inferStudioTabFromModel(modelFromUrl);
          if (inferred && inferred !== activeTab) {
            setActiveTab(inferred);
          }
        }
      }
      const promptFromUrl = sp.get('prompt') || sp.get('remixPrompt');
      if (promptFromUrl && promptFromUrl !== currentRemixPrompt) {
        setCurrentRemixPrompt(promptFromUrl);
      }
      const tabFromQuery = sp.get('tab');
      if (tabFromQuery) {
        const normalized = normalizeStudioTab(tabFromQuery);
        if (normalized && normalized !== activeTab) {
          setActiveTab(normalized);
        }
      }
    }
  }, [initialModel, activeTab, currentRemixPrompt]);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState('login');
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const onboardingPromptedRef = useRef(false);
  const pendingAuthResolverRef = useRef(null);

  // 针对未完成新用户设置的创作者，主动推送轻量入驻设置与额度领取弹窗
  useEffect(() => {
    if (accountUser && accountUser.onboardingCompleted === false && !onboardingPromptedRef.current) {
      const dismissed = typeof window !== 'undefined' && sessionStorage.getItem('supdance_onboarding_dismissed');
      if (!dismissed) {
        setShowOnboardingModal(true);
        onboardingPromptedRef.current = true;
      }
    }
  }, [accountUser]);

  const refreshAccount = useCallback(async () => {
    try {
      const res = await refreshSession(true);
      if (res?.user) {
        setAccountUser(res.user);
        setAccountCredits(res.credits ?? null);
        return res.user;
      }
      setAccountUser(null);
      setAccountCredits(null);
      return null;
    } catch {
      return null;
    }
  }, [refreshSession]);

  // 全站积分与额度变更事件总线监听 (即时响应数据库扣减)
  useEffect(() => {
    const handleCreditsUpdated = () => {
      refreshAccount();
    };
    window.addEventListener('supdance:credits-updated', handleCreditsUpdated);
    return () => window.removeEventListener('supdance:credits-updated', handleCreditsUpdated);
  }, [refreshAccount]);

  // 路由回退/前进同步 model 与 tab 参数
  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const modelFromUrl = sp.get('model');
      if (modelFromUrl !== null) {
        setSelectedModelKey(modelFromUrl);
      }
      const tabFromUrl = sp.get('tab');
      if (tabFromUrl) {
        const normalized = normalizeStudioTab(tabFromUrl);
        if (normalized) setActiveTab(normalized);
      } else if (modelFromUrl) {
        const inferred = inferStudioTabFromModel(modelFromUrl);
        if (inferred) setActiveTab(inferred);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 全站用户资料与头像变更事件总线监听 (即时响应无需整页刷新)
  useEffect(() => {
    const handleProfileUpdated = (e) => {
      if (e.detail?.avatarUrl !== undefined || e.detail?.user) {
        if (e.detail.user) {
          setAccountUser((prev) => (prev ? { ...prev, ...e.detail.user } : e.detail.user));
        } else if (e.detail.avatarUrl !== undefined) {
          setAccountUser((prev) =>
            prev ? { ...prev, avatar_url: e.detail.avatarUrl, avatar: e.detail.avatarUrl } : prev
          );
        }
      }
      refreshAccount();
    };
    window.addEventListener('user-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdated);
  }, [refreshAccount]);

  // 全局额度守卫：当点击消耗模型额度的动作时被触发
  const requireAccountGate = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      // 1. 如果已有登录用户或已有 apiKey，直接放行
      if (accountUser) {
        resolve(accountUser);
        return;
      }
      const currentUser = await refreshAccount();
      if (currentUser) {
        resolve(currentUser);
        return;
      }
      // 2. 未登录，挂起 Promise 并打开 AuthModal 弹窗
      pendingAuthResolverRef.current = { resolve, reject };
      setShowAuthModal(true);
    });
  }, [accountUser, refreshAccount]);

  // muapi 层遇到 401/403 只派发 muapi:auth-required，此前无人监听，token 过期后页面
  // 只是静默显示空数据；接回现有 AuthModal 才会真正提示重新登录。
  useEffect(() => {
    const handleAuthRequired = () => {
      setApiKey(null);
      setAccountUser(null);
      setAccountCredits(null);
      setShowAuthModal(true);
    };
    window.addEventListener('muapi:auth-required', handleAuthRequired);
    window.addEventListener('supdance:auth-required', handleAuthRequired);
    return () => {
      window.removeEventListener('muapi:auth-required', handleAuthRequired);
      window.removeEventListener('supdance:auth-required', handleAuthRequired);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SUPDANCE_REQUIRE_ACCOUNT__ = requireAccountGate;
      window.__SUPDANCE_REQUIRE_API_KEY__ = async () => {
        const user = await requireAccountGate();
        return user ? 'supdance-account-session' : null;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__SUPDANCE_REQUIRE_ACCOUNT__;
        delete window.__SUPDANCE_REQUIRE_API_KEY__;
      }
    };
  }, [requireAccountGate]);

  // Global generation notifications remain mounted while users switch studios.
  const [notifications, setNotifications] = useState([]);
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);
  const [generationCounts, setGenerationCounts] = useState({});
  const lastAuthNoticeTimeRef = useRef(0);

  // 个人中心悬浮窗状态
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState('price-details');
  // 会员订阅独立浮窗状态
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  // 创作者个人资料浮窗状态
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [profileModalCreator, setProfileModalCreator] = useState(null);

  useEffect(() => {
    setNotifications(loadStoredNotifications());
    setNotificationsHydrated(true);
  }, []);

  const pushNotification = useCallback((notif) => {
    const now = Date.now();
    const id = `notif-${Date.now()}-${Math.random()}`;
    const ttl = notif.category === 'auth' ? 5000 : 12000;
    const entry = { ...notif, id, expiresAt: now + ttl };
    setNotifications((previous) => {
      const next = [
        ...previous.filter((notification) => notification.expiresAt > now),
        entry,
      ].slice(-MAX_VISIBLE_NOTIFICATIONS);
      persistNotifications(next);
      return next;
    });
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((previous) => {
      const next = previous.filter((notification) => notification.id !== id);
      persistNotifications(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!notificationsHydrated) return;

    persistNotifications(notifications);
  }, [notifications, notificationsHydrated]);

  useEffect(() => {
    if (notifications.length === 0) return undefined;

    const nextExpiry = Math.min(...notifications.map((notification) => notification.expiresAt));
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setNotifications((previous) => previous.filter((notification) => notification.expiresAt > now));
    }, Math.max(0, nextExpiry - Date.now()));

    return () => window.clearTimeout(timer);
  }, [notifications]);

  // 监听 URL 中的 account=open / subscription=open 参数或全局自定义事件
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'open') {
      setIsSubscriptionModalOpen(true);
    }
    const rawTab = params.get('tab');
    if (rawTab === 'membership' || rawTab === 'subscription') {
      setIsSubscriptionModalOpen(true);
    } else if (params.get('account') === 'open' || params.has('action')) {
      const tab = params.get('accountTab') || params.get('action') || 'price-details';
      setAccountModalTab(tab);
      setIsAccountModalOpen(true);
    }

    const handleOpenAccount = (e) => {
      const tab = e.detail?.tab;
      if (tab === 'membership' || tab === 'subscription') {
        setIsSubscriptionModalOpen(true);
        return;
      }
      if (tab) {
        setAccountModalTab(tab);
      }
      setIsAccountModalOpen(true);
    };

    const handleOpenSubscription = () => {
      setIsSubscriptionModalOpen(true);
    };

    const authAction = params.get('auth');
    if (authAction === 'register') {
      setAuthModalInitialMode('register');
      setShowAuthModal(true);
    } else if (authAction === 'login') {
      setAuthModalInitialMode('login');
      setShowAuthModal(true);
    }

    const handleOpenAuth = (e) => {
      const mode = e?.detail?.mode === 'register' ? 'register' : 'login';
      setAuthModalInitialMode(mode);
      setShowAuthModal(true);
    };

    const handleInsufficientCredits = (e) => {
      const msg = e?.detail?.message || '算力额度不足，请先充值或升级套餐';
      pushNotification({
        type: 'warning',
        category: 'billing',
        label: '算力不足',
        message: msg,
      });
      setIsSubscriptionModalOpen(true);
    };

    const handleOpenRecharge = () => {
      setIsSubscriptionModalOpen(true);
    };

    const handleOpenProfile = (e) => {
      const detail = e?.detail || {};
      setProfileModalUserId(detail.userId || null);
      setProfileModalCreator(detail.creator || null);
      setIsProfileModalOpen(true);
    };

    const handleCloseProfile = () => {
      setIsProfileModalOpen(false);
    };

    window.addEventListener('open-auth-modal', handleOpenAuth);
    window.addEventListener('open-account-modal', handleOpenAccount);
    window.addEventListener('open-subscription-modal', handleOpenSubscription);
    window.addEventListener('open-profile-modal', handleOpenProfile);
    window.addEventListener('close-profile-modal', handleCloseProfile);
    window.addEventListener('supdance:insufficient-credits', handleInsufficientCredits);
    window.addEventListener('supdance:open-recharge', handleOpenRecharge);
    window.addEventListener('open-recharge-modal', handleOpenRecharge);
    return () => {
      window.removeEventListener('open-auth-modal', handleOpenAuth);
      window.removeEventListener('open-account-modal', handleOpenAccount);
      window.removeEventListener('open-subscription-modal', handleOpenSubscription);
      window.removeEventListener('open-profile-modal', handleOpenProfile);
      window.removeEventListener('close-profile-modal', handleCloseProfile);
      window.removeEventListener('supdance:insufficient-credits', handleInsufficientCredits);
      window.removeEventListener('supdance:open-recharge', handleOpenRecharge);
      window.removeEventListener('open-recharge-modal', handleOpenRecharge);
    };
  }, [pushNotification]);

  const handleCloseSubscriptionModal = useCallback(() => {
    setIsSubscriptionModalOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has('subscription')) {
        url.searchParams.delete('subscription');
        changed = true;
      }
      if (url.searchParams.get('tab') === 'membership' || url.searchParams.get('tab') === 'subscription') {
        url.searchParams.delete('tab');
        changed = true;
      }
      if (url.searchParams.get('account') === 'open') {
        url.searchParams.delete('account');
        changed = true;
      }
      if (changed) {
        window.history.replaceState(null, '', url.toString());
      }
    }
    refreshAccount();
  }, [refreshAccount]);

  const handleCloseAccountModal = useCallback(() => {
    setIsAccountModalOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('account') || url.searchParams.has('action')) {
        url.searchParams.delete('account');
        url.searchParams.delete('action');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAccountUser(null);
    setAccountCredits(null);
    setIsAccountModalOpen(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('muapi_key');
        localStorage.removeItem('ko_user');
      } catch {}
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const remixPrompt = searchParams.get('remixPrompt') || searchParams.get('prompt');
    const referenceImage = searchParams.get('referenceImage') || searchParams.get('refImage');
    if (referenceImage) {
      pushNotification({
        type: 'info',
        tabId: activeTab,
        label: '智能参考图',
        message: '已自动绑定作品参考图，支持图生图与风格迁移',
      });
    }
    if (remixPrompt) {
      setCurrentRemixPrompt(remixPrompt);
      pushNotification({
        type: 'success',
        tabId: activeTab,
        label: '作品同款',
        message: `已自动载入同款提示词: "${remixPrompt.slice(0, 25)}..."`,
      });
      setTimeout(() => {
        const textareas = document.querySelectorAll('textarea');
        if (textareas.length > 0) {
          const target = textareas[0];
          target.value = remixPrompt;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 600);
    }
  }, [activeTab, pushNotification]);

  const handleAuthSuccess = useCallback((user, entitlements) => {
    setAccountUser(user);
    setAccountCredits(entitlements?.credits ?? 10);
    setShowAuthModal(false);
    if (pendingAuthResolverRef.current) {
      const { resolve } = pendingAuthResolverRef.current;
      pendingAuthResolverRef.current = null;
      resolve(user);
    }
  }, []);

  const handleAuthClose = useCallback(() => {
    setShowAuthModal(false);
    setAuthModalInitialMode('login');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('auth')) {
        url.searchParams.delete('auth');
        window.history.replaceState(null, '', url.toString());
      }
    }
    if (pendingAuthResolverRef.current) {
      const { reject } = pendingAuthResolverRef.current;
      pendingAuthResolverRef.current = null;
      reject(new Error('用户取消了登录'));
    }
  }, []);

  // 监听全局登录成功事件与三方登录（跨窗口 BroadcastChannel、storage 与 URL 回调）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalAuthSuccess = (e) => {
      if (e.detail?.user) {
        handleAuthSuccess(e.detail.user, e.detail.entitlements);
      }
    };
    window.addEventListener('supdance-auth-success', handleGlobalAuthSuccess);

    const handleAuthCompleteData = (data) => {
      if (!data || data.type !== 'supdance-auth-complete') return;
      if (data.action === 'bind') return; // 个人中心绑定模式由 ProfileTab 处理

      const now = Date.now();
      if (now - lastAuthNoticeTimeRef.current < 3000) return;
      lastAuthNoticeTimeRef.current = now;

      if (data.ok) {
        const syncAccountWithRetry = async (attempts = 3, delay = 250) => {
          const user = await refreshAccount();
          if (user) return user;
          if (attempts > 1) {
            await new Promise((r) => setTimeout(r, delay));
            return syncAccountWithRetry(attempts - 1, delay * 1.5);
          }
          return null;
        };

        syncAccountWithRetry().then((user) => {
          const finalUser = user || data.user;
          if (finalUser) {
            handleAuthSuccess(finalUser, null);
            pushNotification({
              type: 'success',
              category: 'auth',
              label: copy.notifications?.socialLogin || '快捷登录成功',
              message: data.message || copy.notifications?.socialLoginSuccess || '登录成功，欢迎使用 SupDance AI Studio！',
            });
          } else {
            pushNotification({
              type: 'error',
              category: 'auth',
              label: copy.notifications?.socialLoginFailed || '快捷登录未完成',
              message: '登录状态同步失败，请刷新页面或重试',
            });
          }
        });
      } else {
        pushNotification({
          type: 'error',
          category: 'auth',
          label: copy.notifications?.socialLoginFailed || '快捷登录未完成',
          message: data.message || copy.notifications?.socialLoginFailedDesc || '第三方授权未完成或已取消',
        });
      }
    };

    // 1. BroadcastChannel 跨窗口通知
    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('supdance_auth_channel');
        bc.onmessage = (event) => handleAuthCompleteData(event.data);
      }
    } catch {}

    // 2. localStorage StorageEvent
    const handleStorage = (event) => {
      if (event.key === 'supdance_auth_event' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          handleAuthCompleteData(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. 检查 URL 中的三方登录状态参数（全页面重定向模式）
    const searchParams = new URLSearchParams(window.location.search);
    const authStatus = searchParams.get('auth');
    const authMsg = searchParams.get('auth_error') || searchParams.get('msg');
    const action = searchParams.get('action');
    if (authStatus && action !== 'bind') {
      const now = Date.now();
      const shouldNotify = now - lastAuthNoticeTimeRef.current >= 3000;
      if (shouldNotify) {
        lastAuthNoticeTimeRef.current = now;
        if (authStatus === 'success') {
          const syncAccountWithRetry = async (attempts = 3, delay = 250) => {
            const user = await refreshAccount();
            if (user) return user;
            if (attempts > 1) {
              await new Promise((r) => setTimeout(r, delay));
              return syncAccountWithRetry(attempts - 1, delay * 1.5);
            }
            return null;
          };

          syncAccountWithRetry().then((user) => {
            if (user) {
              handleAuthSuccess(user, null);
              pushNotification({
                type: 'success',
                category: 'auth',
                label: copy.notifications?.socialLogin || '快捷登录成功',
                message: copy.notifications?.socialLoginSuccess || '登录成功，欢迎使用 SupDance AI Studio！',
              });
            } else {
              pushNotification({
                type: 'error',
                category: 'auth',
                label: copy.notifications?.socialLoginFailed || '快捷登录未完成',
                message: '登录状态同步失败，请刷新页面或重试',
              });
            }
          });
        } else if (authStatus === 'error') {
          pushNotification({
            type: 'error',
            category: 'auth',
            label: copy.notifications?.socialLoginFailed || '快捷登录未完成',
            message: authMsg || (copy.notifications?.socialLoginFailedDesc || '第三方授权未完成或已取消'),
          });
        }
      }
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('auth');
      nextUrl.searchParams.delete('msg');
      nextUrl.searchParams.delete('auth_error');
      nextUrl.searchParams.delete('action');
      nextUrl.searchParams.delete('isNew');
      nextUrl.searchParams.delete('provider');
      window.history.replaceState(null, '', nextUrl.pathname + (nextUrl.search ? nextUrl.search : '') + nextUrl.hash);
    }

    return () => {
      window.removeEventListener('supdance-auth-success', handleGlobalAuthSuccess);
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [handleAuthSuccess, pushNotification, activeTab, copy, refreshAccount]);


  // 动态动效配置与特性开关
  const [motionConfig, setMotionConfig] = useState({
    motionLevel: 'full',
    ambientGlow: true,
    cardTiltHover: true,
    bannerPulse: true,
  });
  const [showExploreApps, setShowExploreApps] = useState(false);
  // A failed model-directory fetch leaves every workbench without selectable
  // models, so that failure must be surfaced and retryable, not a silent empty list.
  const [modelDirectoryState, setModelDirectoryState] = useState('loading');
  const [studioConfigAttempt, setStudioConfigAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setModelDirectoryState('loading');
    async function initStudioConfig() {
      try {
        const [contentRes, modelsRes] = await Promise.all([
          fetch('/api/site/content-config').catch(() => null),
          fetch('/api/models/active?schemaVersion=2').catch(() => null),
        ]);
        if (!active) return;

        if (contentRes && contentRes.ok) {
          const contentData = await contentRes.json().catch(() => null);
          if (contentData?.motion) setMotionConfig(contentData.motion);
          if (contentData?.features?.explore_apps_enabled !== undefined) {
            setShowExploreApps(Boolean(contentData.features.explore_apps_enabled));
          }
        }

        if (modelsRes && modelsRes.ok) {
          const modelsData = await modelsRes.json().catch(() => null);
          if (Array.isArray(modelsData?.models) && typeof applyActiveModelDirectory === 'function') {
            applyActiveModelDirectory(modelsData.models);
            setModelDirectoryState('ready');
            return;
          }
        }
        setModelDirectoryState('error');
      } catch (err) {
        console.warn('Failed to load studio config:', err?.message || err);
        if (active) setModelDirectoryState('error');
      }
    }
    initStudioConfig();
    return () => { active = false; };
  }, [studioConfigAttempt]);

  // Sidebar Collapsed & Mobile Drawer State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sidebar_collapsed');
      if (stored === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch {}
  }, []);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState(() => (
    getNavigationCategory(getInitialTab())?.id || NAVIGATION_CATEGORIES[0].id
  ));
  const activeCategory = getNavigationCategory(activeTab);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next ? 'true' : 'false');
      return next;
    });
  }, []);

  const handleCategoryToggle = useCallback((categoryId) => {
    const isCollapsedNavigation = isSidebarCollapsed && !isMobileOpen;

    if (!isCollapsedNavigation) {
      setExpandedCategoryId((currentId) => (
        currentId === categoryId ? null : categoryId
      ));
      return;
    }

    setExpandedCategoryId(categoryId);
    toggleSidebar();
  }, [isMobileOpen, isSidebarCollapsed, toggleSidebar]);

  useEffect(() => {
    if (activeCategory?.id) {
      setExpandedCategoryId(activeCategory.id);
    }
  }, [activeCategory?.id]);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState(null);

  const fetchBalance = useCallback(async (key) => {
    try {
      const data = await getUserBalance(key);
      setBalance(data.balance);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  }, []);

  const makeSuccessCallback = useCallback((tabId) => (data) => {
    const tab = TABS.find(t => t.id === tabId);
    let shouldNotify = true;
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('supdance_user_preferences') || '{}');
        if (stored.notifyOnComplete === false) shouldNotify = false;
      } catch {}
    }
    if (shouldNotify) {
      pushNotification({
        type: 'success',
        tabId,
        label: tab?.label || tabId,
        resultUrl: data?.url || null,
      });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`${tab?.label || 'SupDance'} 生成完成`, {
            body: '您的生成任务已顺利完成，点击查看结果',
            icon: '/branding/logo.png',
          });
        } catch {}
      }
    }
    refreshAccount();
  }, [pushNotification, refreshAccount]);

  const makeErrorCallback = useCallback((tabId) => (errorOrMessage) => {
    const tab = TABS.find(t => t.id === tabId);
    const message = typeof errorOrMessage === 'string'
      ? errorOrMessage
      : (errorOrMessage?.message || errorOrMessage?.error || String(errorOrMessage || 'Generation failed'));
    pushNotification({ type: 'error', tabId, label: tab?.label || tabId, message });
    refreshAccount();
    if (apiKey) void fetchBalance(apiKey);
  }, [apiKey, fetchBalance, pushNotification, refreshAccount]);

  const makeGenerationStartCallback = useCallback((tabId) => () => {
    setGenerationCounts((previous) => ({
      ...previous,
      [tabId]: (previous[tabId] || 0) + 1,
    }));
  }, []);

  const makeGenerationEndCallback = useCallback((tabId) => () => {
    setGenerationCounts((previous) => {
      const currentCount = previous[tabId] || 0;
      if (currentCount <= 1) {
        const next = { ...previous };
        delete next[tabId];
        return next;
      }

      return {
        ...previous,
        [tabId]: currentCount - 1,
      };
    });
  }, []);

  const activeGenerations = TABS
    .filter((tab) => generationCounts[tab.id] > 0)
    .map((tab) => ({
      tabId: tab.id,
      label: tabLabel(tab.id),
      count: generationCounts[tab.id],
    }));

  // Popstate event listener to sync tab state with URL on back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      // Strip the locale root prefix (if any) before reading the
      // /studio/<tab> segment, so this works for both /studio/<tab> and
      // /<locale>/studio/<tab>.
      const { rootPath } = getLocaleConfig(locale);
      const localeAwarePath = rootPath && path.startsWith(rootPath) ? path.slice(rootPath.length) : path;
      const segments = localeAwarePath.split('/').filter(Boolean);
      let tabId = segments[1];
      if (!tabId && typeof window !== 'undefined') {
        const queryTab = new URLSearchParams(window.location.search).get('tab');
        if (queryTab && STUDIO_TAB_IDS.includes(queryTab)) {
          tabId = queryTab;
        }
      }
      tabId = tabId || 'image';
      if (TABS.find(t => t.id === tabId)) {
        setActiveTab(tabId);
      }
    };
    window.addEventListener('popstate', handlePopState);

    const handleRelay = (e) => {
      const { targetTab } = e.detail || {};
      if (targetTab && TABS.some((t) => t.id === targetTab)) {
        setActiveTab(targetTab);
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('supdance-relay-video', handleRelay);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('supdance-relay-video', handleRelay);
    };
  }, [locale]);

  const handleTabChange = useCallback((tabId) => {
    window.history.pushState(null, '', studioPath(tabId));
    setActiveTab(tabId);
    setSelectedModelKey('');
  }, [studioPath]);

  const handleOpenNotification = useCallback((notification) => {
    handleTabChange(notification.tabId);
    dismissNotification(notification.id);
  }, [dismissNotification, handleTabChange]);

  const handleTabClick = (e, tabId) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleTabChange(tabId);
      return true;
    }
    return false;
  };

  const handleNavigationItemClick = (event, tabId) => {
    if (handleTabClick(event, tabId)) {
      setIsMobileOpen(false);
    }
  };

  const handleMegaMenuSelect = useCallback((e, tabId, modelKey) => {
    if (tabId) {
      if (e?.preventDefault) e.preventDefault();
      let targetUrl = studioPath(tabId);
      if (modelKey) {
        const url = new URL(targetUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        url.searchParams.set('model', modelKey);
        targetUrl = url.pathname + url.search;
        setSelectedModelKey(modelKey);
      } else {
        setSelectedModelKey('');
      }
      window.history.pushState(null, '', targetUrl);
      setActiveTab(tabId);
      setIsMobileOpen(false);

      if (modelKey && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supdance-select-model', { detail: { modelKey, modelId: modelKey, tabId } }));
      }
    }
  }, [studioPath]);

  // Auto-hide header when inside a specific workflow view or design agent
  useEffect(() => {
    const isEditingWorkflow = (activeTab === 'workflows' || !!idFromParams) && urlWorkflowId;
    const isDesignAgent = activeTab === 'design-agent';
    
    if (isEditingWorkflow || isDesignAgent) {
      setIsHeaderVisible(false);
    } else {
      setIsHeaderVisible(true);
    }
  }, [activeTab, urlWorkflowId, idFromParams]);

  // Global builder CSS cleanup when switching away from Workflows or Design Agent tabs
  useEffect(() => {
    const fromBuilder = sessionStorage.getItem("fromWorkflowBuilder");
    const fromDesignAgent = sessionStorage.getItem("fromDesignAgent");
    
    if ((fromBuilder && activeTab !== 'workflows') || (fromDesignAgent && activeTab !== 'design-agent')) {
      sessionStorage.removeItem("fromWorkflowBuilder");
      sessionStorage.removeItem("fromDesignAgent");
      window.location.reload();
    }
  }, [activeTab]);

  useEffect(() => {
    setHasMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      fetchBalance(stored);
    }
  }, [fetchBalance]);

  const handleKeySave = useCallback((key) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
    fetchBalance(key);
  }, [fetchBalance]);

  const handleKeyChange = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setBalance(null);
    document.cookie = "muapi_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }, []);

  // Ensure legacy global or cookie client keys are cleared; backend auth uses HTTP-only ko_session.
  useEffect(() => {
    delete axios.defaults.headers.common['x-api-key'];
  }, []);

  // Poll for balance every 30 seconds if key is present
  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => fetchBalance(apiKey), 30000);
    return () => clearInterval(interval);
  }, [apiKey, fetchBalance]);

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const isFileDrag = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
    if (isFileDrag && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container itself, not moving between children
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  }, []);

  const handleFilesHandled = useCallback(() => {
    setDroppedFiles(null);
  }, []);

  return (
    <div 
      className="relative flex h-screen flex-col overflow-hidden bg-base text-ink"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* SupDance AI 空间光影视觉系统 (Studio 级静谧克制光场) */}
      <SpatialBackground
        variant="studio"
        showAurora={motionConfig.ambientGlow}
        showGrid={true}
        showArc={true}
      />
      {/* Drag Overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-toast flex items-center justify-center border-4 border-dashed border-brand-ring bg-brand-soft backdrop-blur-md transition-opacity duration-slow">
          <div className="flex scale-110 animate-pulse flex-col items-center gap-4 rounded-3xl border border-line bg-overlay p-8 shadow-elevation-4">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-brand text-ink-on-accent">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-page-title font-bold text-ink">{copy.shell.dropHere}</span>
              <span className="text-body-sm text-ink-subtle">{copy.shell.dropHereHint}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {isHeaderVisible && (
        <>
          <header className="fixed top-0 inset-x-0 z-header flex h-14 shrink-0 items-center justify-between gap-2 sm:gap-4 bg-surface-glass border-b border-line-subtle px-3 sm:px-4 backdrop-blur-md select-none">
            {/* Left: Mobile menu toggle + Logo + TopMegaNavigation */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Mobile drawer toggle */}
              <IconButton
                icon={Menu}
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="lg:hidden shrink-0"
                label={copy.shell.toggleNavMenu}
              />

              {/* Logo & Title (动态品牌与Logo) */}
              <Link
                href={siteBrand?.logoHref || studioPath('image')}
                target={siteBrand?.logoTarget || '_self'}
                className="group flex items-center gap-2.5 cursor-pointer shrink-0"
                aria-label={siteBrand?.brandName || copy.shell.brand}
              >
                <BrandLogo brand={siteBrand} />
              </Link>

              {/* 顶栏水平 Mega Menu 导航 (桌面端 lg: 呈现) */}
              <div className="hidden lg:flex items-center min-w-0 flex-1 ml-2">
                <TopMegaNavigation
                  activeTab={activeTab}
                  locale={locale}
                  onSelectTab={handleMegaMenuSelect}
                />
              </div>
            </div>

            {/* Right: Actions (右上角固定图标功能区: 额度、提醒、语言切换、用户头像) */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <UserDropdownMenu
                user={accountUser}
                credits={accountCredits}
                entitlements={sessionEntitlements}
                locale={locale}
                onOpenSettings={() => {
                  setAccountModalTab('settings');
                  setIsAccountModalOpen(true);
                }}
                onOpenAccount={(tab) => {
                  if (tab === 'membership' || tab === 'subscription') {
                    setIsSubscriptionModalOpen(true);
                  } else {
                    setAccountModalTab(tab);
                    setIsAccountModalOpen(true);
                  }
                }}
                onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
                onLogout={handleLogout}
                onOpenAuth={() => setShowAuthModal(true)}
              />
            </div>
          </header>
          <div className="h-14 shrink-0 w-full pointer-events-none select-none" aria-hidden="true" />
        </>
      )}

      {/* Main Body Layout: Mobile Sidebar Drawer + Studio Content Area */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {isMobileOpen && (
          <div 
            className="bg-scrim z-sticky animate-fade-in fixed inset-0 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile Drawer (仅在移动端/小屏 lg:hidden 下作为侧边抽屉呈现) */}
        {isHeaderVisible && (
          <aside
            className={`
              bg-surface-glass z-drawer fixed bottom-0 left-0 top-14 flex shrink-0 select-none flex-col border-r border-line-subtle backdrop-blur-md transition-transform duration-slow ease-standard w-sidebar lg:hidden
              ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
          >
            <nav aria-label={copy.shell.studioNavigation} className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-2">
              <div className="space-y-1">
                {NAVIGATION_CATEGORIES.map((category) => {
                  const isCategoryActive = activeCategory?.id === category.id;
                  const isCollapsed = isSidebarCollapsed && !isMobileOpen;
                  const isCategoryOpen = !isCollapsed && expandedCategoryId === category.id;
                  const categoryPanelId = `navigation-category-${category.id}`;
                  const categoryLabelText = categoryLabel(category.id);

                  return (
                    <div key={category.id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleCategoryToggle(category.id)}
                        aria-label={categoryLabelText}
                        aria-expanded={isCategoryOpen}
                        aria-controls={isCollapsed ? undefined : categoryPanelId}
                        title={isCollapsed ? categoryLabelText : undefined}
                        className={`
                          group relative flex items-center rounded-xl border font-semibold transition-colors duration-fast
                          ${isCollapsed ? 'mx-auto h-11 w-11 justify-center' : 'min-h-11 w-full gap-3 px-3 py-2.5 text-left'}
                          ${isCategoryActive
                            ? 'border-brand-line bg-brand-soft text-brand'
                            : isCategoryOpen
                              ? 'border-line bg-wash-strong text-ink'
                              : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink'
                          }
                        `}
                      >
                        {isCategoryActive && (
                          <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-brand" />
                        )}

                        <span className={`shrink-0 transition-colors ${isCategoryActive ? 'text-brand' : 'text-ink-muted group-hover:text-ink'}`}>
                          {category.icon}
                        </span>

                        {!isCollapsed && (
                          <>
                            <span className="text-label min-w-0 flex-1">
                              {categoryLabelText}
                            </span>
                            <ChevronDown
                              className={`size-4 shrink-0 transition-transform duration-base ${isCategoryOpen ? 'rotate-180' : ''}`}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                          </>
                        )}
                      </button>

                      {!isCollapsed && isCategoryOpen && (
                        <div
                          id={categoryPanelId}
                          role="group"
                          aria-label={`${categoryLabelText} ${copy.shell.toolsSuffix}`}
                          className="ml-2 mt-1 max-h-64 space-y-1 overflow-y-auto border-l border-line pl-2"
                        >
                          {category.tabIds.map((tabId) => {
                            const tab = TABS.find((item) => item.id === tabId);
                            if (!tab) return null;
                            const isActive = activeTab === tab.id;

                            return (
                              <a
                                key={tab.id}
                                href={studioPath(tab.id)}
                                onClick={(event) => handleNavigationItemClick(event, tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`
                                  group relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-label font-medium transition-colors duration-fast
                                  ${isActive
                                    ? 'border-brand-line bg-brand-soft text-brand'
                                    : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink'
                                  }
                                `}
                              >
                                {isActive && (
                                  <span className="absolute -left-2.5 bottom-2 top-2 w-0.5 rounded-full bg-brand" />
                                )}
                                <span className={`shrink-0 ${isActive ? 'text-brand' : 'text-ink-subtle group-hover:text-ink-muted'}`}>
                                  {tab.icon}
                                </span>
                                <span className="truncate">{tabLabel(tab.id)}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-line-subtle pt-3">
                <Link
                  href="/canvas"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileOpen(false)}
                  className={`group flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-body-sm font-medium text-ink-muted transition-colors duration-fast hover:bg-wash hover:text-ink ${FOCUS_RING}`}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-ink-subtle transition-colors duration-fast group-hover:border-line-strong group-hover:bg-wash-strong group-hover:text-ink">
                    <Workflow className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{locale.startsWith('zh') ? '无限画布' : 'Infinite Canvas'}</span>
                  <ExternalLink className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                </Link>
              </div>

              {showExploreApps && EXPLORE_APPS_TAB && (
                <div className="mt-3 border-t border-line-subtle pt-3">
                  <a
                    href={studioPath(EXPLORE_APPS_TAB.id)}
                    onClick={(event) => handleNavigationItemClick(event, EXPLORE_APPS_TAB.id)}
                    aria-current={activeTab === EXPLORE_APPS_TAB.id ? 'page' : undefined}
                    aria-label={tabLabel(EXPLORE_APPS_TAB.id)}
                    title={isSidebarCollapsed && !isMobileOpen ? tabLabel(EXPLORE_APPS_TAB.id) : undefined}
                    className={`
                      group relative flex items-center rounded-xl border text-body-sm font-semibold transition-colors duration-fast
                      ${isSidebarCollapsed && !isMobileOpen ? 'mx-auto h-11 w-11 justify-center' : 'w-full gap-3 px-3 py-2.5'}
                      ${activeTab === EXPLORE_APPS_TAB.id
                        ? 'border-brand-line bg-brand-soft text-brand'
                        : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink'
                      }
                    `}
                  >
                    {activeTab === EXPLORE_APPS_TAB.id && (
                      <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-brand" />
                    )}
                    <span className={`shrink-0 ${activeTab === EXPLORE_APPS_TAB.id ? 'text-brand' : 'text-ink-muted group-hover:text-ink'}`}>
                      {EXPLORE_APPS_TAB.icon}
                    </span>
                    {(!isSidebarCollapsed || isMobileOpen) && (
                      <span className="truncate">{tabLabel(EXPLORE_APPS_TAB.id)}</span>
                    )}
                  </a>
                </div>
              )}
            </nav>
          </aside>
        )}

        {/* Studio Content */}
        <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-transparent" data-active-studio={activeTab}>
          {modelDirectoryState === 'error' && (
            <div
              className="absolute inset-x-4 top-4 z-40 mx-auto flex max-w-lg items-center gap-3 rounded-lg border border-warning-line bg-warning-soft px-4 py-2.5 shadow-elevation-4"
              role="alert"
            >
              <AlertCircle className="size-4 shrink-0 text-warning" />
              <span className="flex-1 text-body-sm text-ink">{copy.shell.modelDirectoryUnavailable}</span>
              <button
                type="button"
                onClick={() => setStudioConfigAttempt((n) => n + 1)}
                className="h-control-md shrink-0 rounded-lg border border-warning-line px-3 text-label font-semibold text-warning transition-colors duration-base hover:bg-warning-soft active:scale-95"
              >
                {copy.shell.retry}
              </button>
            </div>
          )}
        {activeTab === 'image' && (
            <StudioResourceBoundary studioId="image">
          <ImageStudio apiKey={apiKey} locale={locale} initialModel={selectedModelKey} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('image')} onGenerationEnd={makeGenerationEndCallback('image')} onGenerationComplete={makeSuccessCallback('image')} onGenerationError={makeErrorCallback('image')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'headshot' && (
            <StudioResourceBoundary studioId="headshot">
          <HeadshotStudio apiKey={apiKey} locale={locale} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('headshot')} onGenerationEnd={makeGenerationEndCallback('headshot')} onGenerationComplete={makeSuccessCallback('headshot')} onGenerationError={makeErrorCallback('headshot')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'layers' && (
            <StudioResourceBoundary studioId="layers">
          <LayersStudio apiKey={apiKey} locale={locale} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('layers')} onGenerationEnd={makeGenerationEndCallback('layers')} onGenerationComplete={makeSuccessCallback('layers')} onGenerationError={makeErrorCallback('layers')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'video' && (
            <StudioResourceBoundary studioId="video">
          <VideoStudio apiKey={apiKey} locale={locale} initialModel={selectedModelKey} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('video')} onGenerationEnd={makeGenerationEndCallback('video')} onGenerationComplete={makeSuccessCallback('video')} onGenerationError={makeErrorCallback('video')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'clipping' && (
            <StudioResourceBoundary studioId="clipping">
          <ClippingStudio apiKey={apiKey} locale={locale} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('clipping')} onGenerationEnd={makeGenerationEndCallback('clipping')} onGenerationComplete={makeSuccessCallback('clipping')} onGenerationError={makeErrorCallback('clipping')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'motion-control' && (
            <StudioResourceBoundary studioId="motion-control">
          <MotionControlStudio apiKey={apiKey} locale={locale} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('motion-control')} onGenerationEnd={makeGenerationEndCallback('motion-control')} onGenerationComplete={makeSuccessCallback('motion-control')} onGenerationError={makeErrorCallback('motion-control')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'vibe-motion' && (
            <StudioResourceBoundary studioId="vibe-motion">
          <VibeMotionStudio apiKey={apiKey} locale={locale} initialPrompt={currentRemixPrompt} onGenerationStart={makeGenerationStartCallback('vibe-motion')} onGenerationEnd={makeGenerationEndCallback('vibe-motion')} onGenerationComplete={makeSuccessCallback('vibe-motion')} onGenerationError={makeErrorCallback('vibe-motion')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'lipsync' && (
            <StudioResourceBoundary studioId="lipsync">
          <LipSyncStudio apiKey={apiKey} locale={locale} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('lipsync')} onGenerationEnd={makeGenerationEndCallback('lipsync')} onGenerationComplete={makeSuccessCallback('lipsync')} onGenerationError={makeErrorCallback('lipsync')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'body-swap' && (
            <StudioResourceBoundary studioId="body-swap">
          <RecastStudio apiKey={apiKey} locale={locale} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('body-swap')} onGenerationEnd={makeGenerationEndCallback('body-swap')} onGenerationComplete={makeSuccessCallback('body-swap')} onGenerationError={makeErrorCallback('body-swap')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'cinema' && (
            <StudioResourceBoundary studioId="cinema">
          <CinemaStudio apiKey={apiKey} locale={locale} initialModel={selectedModelKey} initialPrompt={currentRemixPrompt} onGenerationStart={makeGenerationStartCallback('cinema')} onGenerationEnd={makeGenerationEndCallback('cinema')} onGenerationComplete={makeSuccessCallback('cinema')} onGenerationError={makeErrorCallback('cinema')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'audio' && (
            <StudioResourceBoundary studioId="audio">
          <AudioStudio apiKey={apiKey} hosted ownerUserId={accountUser?.id} locale={locale} initialModel={selectedModelKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('audio')} onGenerationEnd={makeGenerationEndCallback('audio')} onGenerationComplete={makeSuccessCallback('audio')} onGenerationError={makeErrorCallback('audio')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'marketing' && (
            <StudioResourceBoundary studioId="marketing">
          <MarketingStudio apiKey={apiKey} locale={locale} initialPrompt={currentRemixPrompt} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('marketing')} onGenerationEnd={makeGenerationEndCallback('marketing')} onGenerationComplete={makeSuccessCallback('marketing')} onGenerationError={makeErrorCallback('marketing')} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'workflows' && (
            <StudioResourceBoundary studioId="workflows">
          <WorkflowStudio
            apiKey={apiKey}
            locale={locale}
            signedIn={!!accountUser}
            onRequireAuth={() => setShowAuthModal(true)}
            isHeaderVisible={isHeaderVisible}
            onToggleHeader={setIsHeaderVisible}
            onGenerationStart={makeGenerationStartCallback('workflows')}
            onGenerationEnd={makeGenerationEndCallback('workflows')}
            onGenerationComplete={makeSuccessCallback('workflows')}
            onGenerationError={makeErrorCallback('workflows')}
          />
            </StudioResourceBoundary>
          )}
        {activeTab === 'agents' && (
            <StudioResourceBoundary studioId="agents">
          <AgentStudio apiKey={apiKey} locale={locale} signedIn={!!accountUser} onRequireAuth={() => setShowAuthModal(true)} initialModel={selectedModelKey} isHeaderVisible={isHeaderVisible} onToggleHeader={setIsHeaderVisible} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'design-agent' && (
            <StudioResourceBoundary studioId="design-agent">

            <DesignAgentStudio
              apiKey={apiKey}
              locale={locale}
              signedIn={!!accountUser}
              authChecked={accountChecked}
              onRequireAuth={() => setShowAuthModal(true)}
              isHeaderVisible={isHeaderVisible}
              onToggleHeader={setIsHeaderVisible}
              onGenerationStart={makeGenerationStartCallback('design-agent')}
              onGenerationEnd={makeGenerationEndCallback('design-agent')}
              onGenerationComplete={makeSuccessCallback('design-agent')}
              onGenerationError={makeErrorCallback('design-agent')}
            />
          
            </StudioResourceBoundary>
          )}
        {activeTab === 'apps' && (
            <StudioResourceBoundary studioId="apps">
          <AppsStudio apiKey={apiKey} locale={locale} />
            </StudioResourceBoundary>
          )}
        {activeTab === 'ai-influencer' && (
            <StudioResourceBoundary studioId="ai-influencer">
          <AiInfluencerStudio
            apiKey={apiKey}
            locale={locale}
            signedIn={!!accountUser}
            onRequireAuth={() => setShowAuthModal(true)}
            onGenerationStart={makeGenerationStartCallback('ai-influencer')}
            onGenerationEnd={makeGenerationEndCallback('ai-influencer')}
            onGenerationComplete={makeSuccessCallback('ai-influencer')}
            onGenerationError={makeErrorCallback('ai-influencer')}
          />
            </StudioResourceBoundary>
          )}
      </div>
    </div>

      {/* Global generation activity and notification stack */}
      {(activeGenerations.length > 0 || notifications.length > 0) && (
        <div
          aria-live="polite"
          aria-label={copy.notifications.ariaLabel}
          className="z-toast pointer-events-none fixed bottom-5 left-5 right-5 top-16 flex flex-col gap-2 overflow-x-hidden overflow-y-auto md:left-auto md:w-toast"
          data-testid="global-notification-stack"
        >
          {activeGenerations.map((generation) => (
            <div
              key={generation.tabId}
              role="status"
              data-generation-tab={generation.tabId}
              className="bg-surface-inverse text-ink-inverse animate-fade-in pointer-events-auto flex items-center gap-3 rounded-xl border border-brand-line px-3.5 py-3 text-body-sm shadow-elevation-3"
              data-testid="generation-activity"
            >
              <span className="border-brand-line flex size-8 shrink-0 items-center justify-center rounded-lg border bg-brand-soft">
                <Spinner className="size-3.5 text-brand" />
              </span>
              <p className="min-w-0 flex-1 font-semibold">
                {generation.label} {copy.notifications.generating}
                {generation.count > 1 ? ` (${generation.count})` : ''}
              </p>
            </div>
          ))}

          {notifications.map((notif) => (
            <div
              key={notif.id}
              role={notif.type === 'error' ? 'alert' : 'status'}
              data-notification-type={notif.type}
              data-notification-tab={notif.tabId}
              className={`
                text-ink animate-fade-in pointer-events-auto flex items-start gap-3 rounded-xl border bg-overlay px-3.5 py-3 text-body-sm shadow-elevation-3
                ${notif.type === 'success' ? 'border-brand-line' : 'border-danger-line'}
              `}
            >
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                  notif.type === 'success'
                    ? 'border-brand-line bg-brand-soft text-brand'
                    : 'border-danger-line bg-danger-soft text-danger'
                }`}
              >
                {notif.type === 'success' ? (
                  <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <AlertCircle className="size-4" strokeWidth={1.8} aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                {notif.category === 'auth' ? (
                  <>
                    <p className="font-semibold text-ink">
                      {notif.label || (notif.type === 'success' ? '快捷登录成功' : '登录未完成')}
                    </p>
                    {notif.message && (
                      <p className={`text-label mt-0.5 line-clamp-2 font-medium ${notif.type === 'error' ? 'text-danger' : 'text-ink-subtle'}`} title={typeof notif.message === 'string' ? notif.message : String(notif.message?.message || notif.message)}>
                        {typeof notif.message === 'string' ? notif.message : String(notif.message?.message || notif.message)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold">
                      {notif.label}
                      <span className="font-normal text-ink-subtle">
                        {' '}
                        {notif.type === 'success' ? copy.notifications.generationComplete : copy.notifications.generationFailed}
                      </span>
                    </p>
                    {notif.type === 'error' && notif.message && (
                      <p className="text-label mt-0.5 line-clamp-2 font-medium text-danger" title={typeof notif.message === 'string' ? notif.message : String(notif.message?.message || notif.message)}>
                        {typeof notif.message === 'string' ? notif.message : String(notif.message?.message || notif.message)}
                      </p>
                    )}
                    {notif.type === 'success' && (
                      <p className="text-label mt-0.5 text-ink-subtle">
                        {copy.notifications.resultReady}
                      </p>
                    )}
                    {notif.type === 'success' && notif.tabId && (
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(notif)}
                        className="text-caption mt-1.5 font-bold text-brand transition-colors hover:text-brand-hover cursor-pointer"
                        aria-label={copy.notifications.openResult.replace('{label}', notif.label)}
                      >
                        {copy.notifications.open}
                      </button>
                    )}
                  </>
                )}
              </div>

              <IconButton
                icon={X}
                size="icon-sm"
                onClick={() => dismissNotification(notif.id)}
                label={copy.notifications.dismissNotification}
                className="mt-0.5 shrink-0"
              />
            </div>
          ))}
        </div>
      )}

      {/* Settings Modal */}
      <Modal open={showSettings} onOpenChange={setShowSettings}>
        <ModalContent
          size="sm"
          title={copy.settingsModal.title}
          description={copy.settingsModal.subtitle}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-wash p-4">
              <p className="text-label text-ink-subtle">
                {copy.settingsModal.activeApiKey}
              </p>
              <p className="text-mono mt-1.5 text-ink">
                {apiKey
                  ? `${apiKey.slice(0, 8)}••••••••••••••••`
                  : copy.shell.apiKeyUnconfigured}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-wash p-4">
              <div className="min-w-0">
                <p className="text-label text-ink-subtle">
                  {copy.settingsModal.interfaceLanguage}
                </p>
                <p className="text-body-sm mt-1 text-ink">{nativeLocaleName}</p>
              </div>
              <LanguageSwitcher showLabel={false} />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="danger" fullWidth onClick={handleKeyChange}>
              {copy.settingsModal.changeKey}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowSettings(false)}
            >
              {copy.settingsModal.close}
            </Button>
          </div>
        </ModalContent>
      </Modal>

      {/* 登录拦截与登录弹窗 */}
      {showAuthModal && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={handleAuthClose}
          locale={locale}
          initialEmailMode={authModalInitialMode}
        />
      )}

      {/* 独立会员订阅浮层 */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={handleCloseSubscriptionModal}
        user={accountUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onSuccess={() => {
          refreshAccount();
        }}
      />

      {/* 个人中心悬浮窗（点击背景当前页面即可关闭） */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={handleCloseAccountModal}
        initialTab={accountModalTab}
        user={accountUser}
        credits={accountCredits}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* 创作者个人资料浮窗 */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userId={profileModalUserId}
        creator={profileModalCreator || (profileModalUserId ? null : accountUser)}
      />

      {/* 新用户资料与额度引导弹窗 */}
      {showOnboardingModal && accountUser && (
        <UserOnboardingModal
          user={accountUser}
          onComplete={(updatedUser) => {
            setShowOnboardingModal(false);
            if (updatedUser) {
              setAccountUser(updatedUser);
              mutateSession(updatedUser);
            }
            refreshAccount();
          }}
          onClose={() => {
            setShowOnboardingModal(false);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('supdance_onboarding_dismissed', '1');
            }
          }}
        />
      )}

      {/* 注销 3 天后悔保护期弹窗 */}
      {accountUser?.isDeletionPending && (
        <DeletionGracePeriodModal
          user={accountUser}
          onCancelled={() => {
            refreshAccount();
          }}
          onLogout={() => {
            setAccountUser(null);
            window.location.href = '/';
          }}
        />
      )}
    </div>
  );
}
