'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Folder } from 'lucide-react';
import { normalizeLocale, localizeStudioPath } from '@/lib/locales';
import { useUserSession } from '@/lib/hooks/useUserSession';
import AssetLibraryWorkspace from '@/components/asset-library/AssetLibraryWorkspace';
import StudioHeader from '@/components/site/StudioHeader';
import AuthModal from '@/components/AuthModal';

const ASSET_CENTER_COPY = {
  en: {
    signInTitle: 'Sign in to Access Assets',
    signInDesc: 'Asset Center securely archives all your generated AI creations. Please sign in to continue.',
    signInBtn: 'Sign In / Register',
    goToLoginPage: 'Go to Login Page',
    navHome: 'Home',
    navStudio: 'Studio',
    navAssets: 'Assets',
    navSubjects: 'Subjects',
    recentChats: 'Recent Chats',
    noRecentChats: 'No recent chats',
    canvases: 'Canvases',
    canvasStudio: 'Canvas Studio',
  },
  'zh-CN': {
    signInTitle: '登录访问个人资产中心',
    signInDesc: '资产中心集中归档您所有的 AI 生图、生视频与音频作品，请先登录您的创作者账号。',
    signInBtn: '立即登录 / 注册',
    goToLoginPage: '跳转完整登录页',
    navHome: '首页',
    navStudio: '创作',
    navAssets: '资产',
    navSubjects: '主体',
    recentChats: '历史创作会话',
    noRecentChats: '暂无历史记录',
    canvases: '设计画布',
    canvasStudio: '自由设计画布',
  },
  'zh-TW': {
    signInTitle: '登入訪問個人資產中心',
    signInDesc: '資產中心集中歸檔您所有的 AI 生圖、生視頻與音頻作品，請先登入您的創作者帳號。',
    signInBtn: '立即登入 / 註冊',
    goToLoginPage: '跳轉完整登入頁',
    navHome: '首頁',
    navStudio: '創作',
    navAssets: '資產',
    navSubjects: '主體',
    recentChats: '歷史創作會話',
    noRecentChats: '暫無歷史記錄',
    canvases: '設計畫布',
    canvasStudio: '自由設計畫布',
  },
  'ja-JP': {
    signInTitle: 'アセットセンターへログイン',
    signInDesc: 'アセットセンターには生成した画像、動画、音楽などの全作品がアーカイブされます。クリエイターアカウントでログインしてください。',
    signInBtn: 'ログイン / 新規登録',
    goToLoginPage: 'ログインページへ',
    navHome: 'ホーム',
    navStudio: '制作',
    navAssets: 'アセット',
    navSubjects: '被写体',
    recentChats: '最近のセッション',
    noRecentChats: '履歴がありません',
    canvases: 'デザインキャンバス',
    canvasStudio: 'フリーデザインキャンバス',
  },
  'ko-KR': {
    signInTitle: '개인 에셋 센터 로그인',
    signInDesc: '에셋 센터는 생성된 모든 AI 이미지, 비디오 및 오디오 작품을 안전하게 보관합니다. 크리에이터 계정으로 로그인해 주세요.',
    signInBtn: '로그인 / 회원가입',
    goToLoginPage: '로그인 페이지로 이동',
    navHome: '홈',
    navStudio: '제작',
    navAssets: '에셋',
    navSubjects: '피사체',
    recentChats: '최근 대화',
    noRecentChats: '최근 기록이 없습니다',
    canvases: '디자인 캔버스',
    canvasStudio: '자유 디자인 캔버스',
  },
  es: {
    signInTitle: 'Inicia sesión para acceder a Activos',
    signInDesc: 'El Centro de Activos archiva de forma segura todas tus creaciones de IA. Inicia sesión para continuar.',
    signInBtn: 'Iniciar Sesión / Registrarse',
    goToLoginPage: 'Ir a Página de Inicio de Sesión',
    navHome: 'Inicio',
    navStudio: 'Estudio',
    navAssets: 'Activos',
    navSubjects: 'Sujetos',
    recentChats: 'Chats Recientes',
    noRecentChats: 'Sin chats recientes',
    canvases: 'Lienzos',
    canvasStudio: 'Lienzo de Diseño',
  },
};

export default function JimengAssetCenter({ locale = 'en', initialUser = null, assetLibraryCopy = null }) {
  const { user, refresh: refreshSession } = useUserSession(initialUser);

  const activeLocale = normalizeLocale(locale);
  const copy = ASSET_CENTER_COPY[activeLocale] || ASSET_CENTER_COPY.en;
  const studioBase = localizeStudioPath(activeLocale);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState([]);
  const handleLibraryAssets = useCallback((assets) => setLibraryAssets(assets), []);

  const dynamicSessions = useMemo(() => {
    const sessions = [];
    const seenPrompts = new Set();
    for (const item of libraryAssets) {
      const prompt = (item.metadata?.prompt || '').trim();
      if (!prompt || seenPrompts.has(prompt)) continue;
      seenPrompts.add(prompt);
      sessions.push({
        id: item.id,
        title: prompt.length > 16 ? `${prompt.slice(0, 16)}...` : prompt,
        fullTitle: prompt,
        tab: item.kind === 'video' ? 'video' : item.kind === 'audio' ? 'audio' : 'image',
        prompt,
        model: item.metadata?.model || '',
      });
      if (sessions.length >= 8) break;
    }
    return sessions;
  }, [libraryAssets]);

  if (!user) {
    const loginTarget = localizeStudioPath(`/login?redirect=${encodeURIComponent(localizeStudioPath('/assets', activeLocale))}`, activeLocale);
    return (
      <div className="min-h-screen bg-base text-ink flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-line bg-overlay p-8 text-center shadow-elevation-4">
          <div className="w-20 h-20 rounded-2xl bg-wash border border-line flex items-center justify-center mx-auto mb-4 text-brand-text">
            <Folder className="w-9 h-9" />
          </div>
          <h2 className="text-section-title font-semibold text-ink mb-2">
            {copy.signInTitle}
          </h2>
          <p className="text-body-sm text-ink-muted leading-relaxed mb-6">
            {copy.signInDesc}
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="w-full h-control-md rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-on-accent text-body-sm font-semibold transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring shadow-elevation-1 cursor-pointer"
            >
              {copy.signInBtn}
            </button>
            <Link
              href={loginTarget}
              className="w-full h-control-md rounded-full bg-surface hover:bg-surface-raised border border-line text-ink-muted hover:text-ink text-body-sm font-medium flex items-center justify-center transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
            >
              {copy.goToLoginPage}
            </Link>
          </div>
        </div>

        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              refreshSession();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-ink flex flex-col overflow-hidden asset-library-shell">
      <StudioHeader locale={activeLocale} initialUser={user} />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <AssetLibraryWorkspace
          userId={user?.id}
          studioHref={studioBase}
          copy={assetLibraryCopy}
          onLibraryAssets={handleLibraryAssets}
          sideNav={{
            studioHref: studioBase,
            subjectsHref: `${studioBase}?tab=headshot`,
            canvasHref: localizeStudioPath('/canvas', activeLocale),
            sessions: dynamicSessions,
            labels: {
              navStudio: copy.navStudio,
              navAssets: copy.navAssets,
              navSubjects: copy.navSubjects,
              recentChats: copy.recentChats,
              noRecentChats: copy.noRecentChats,
              canvases: copy.canvases,
              canvasStudio: copy.canvasStudio,
            },
          }}
        />
      </div>
    </div>
  );
}
