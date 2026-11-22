'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, EyeOff, Loader2 } from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import CommunityDetailModal from '@/components/community/CommunityDetailModal';
import AuthModal from '@/components/AuthModal';
import { localizeStudioPath } from '@/lib/locales';
import UserProfileHeaderCard from './UserProfileHeaderCard';
import UserProfileCreations from './UserProfileCreations';
import UserProfileActivity from './UserProfileActivity';
import { getProfileStrings, useProfileLocale } from './profileI18n';

export default function UserProfileView({
  creator: initialCreator = null,
  userId = null,
  initialTab = 'creations',
  showHeader = false,
  showBackLink = false,
  embedded = false,
  compact = false,
  onClose = null,
  className = '',
  locale = null,
}) {
  const activeLocale = useProfileLocale(locale);
  const strings = useMemo(() => getProfileStrings(activeLocale), [activeLocale]);
  const [creator, setCreator] = useState(initialCreator);
  const [loadingCreator, setLoadingCreator] = useState(!initialCreator && Boolean(userId));
  const [activeTab, setActiveTab] = useState(initialTab);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialCreator?.followersCount || 0);
  const [followBusy, setFollowBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(''), 3000);
  };

  // 1. 若没有传入完整的 creator，但提供了 userId，则拉取 creator 资料
  useEffect(() => {
    if (initialCreator) {
      setCreator(initialCreator);
      setFollowersCount(initialCreator.followersCount || 0);
      return;
    }
    if (!userId) return;

    let mounted = true;
    async function fetchCreator() {
      setLoadingCreator(true);
      try {
        const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.user) {
            const u = data.user;
            const canonicalNumber = u.userNumber || u.user_number || String(u.id);
            const c = {
              id: u.id,
              userNumber: canonicalNumber,
              displayName: u.displayName || u.display_name || strings.creatorFallback(canonicalNumber),
              avatarUrl: u.avatar_url || u.avatarUrl || null,
              bio: u.bio || '',
              followersCount: u.followers_count || u.followersCount || 0,
              followingCount: u.following_count || u.followingCount || 0,
              createdAt: u.created_at || u.createdAt || null,
              isActivityPublic: u.is_activity_public ?? u.isActivityPublic ?? true,
            };
            setCreator(c);
            setFollowersCount(c.followersCount);
          }
        }
      } catch (err) {
        console.error('获取创作者资料失败:', err);
      } finally {
        if (mounted) setLoadingCreator(false);
      }
    }
    fetchCreator();
    return () => {
      mounted = false;
    };
  }, [initialCreator, userId, strings]);

  // 2. 获取当前登录用户与关注状态
  useEffect(() => {
    if (!creator?.id) return;
    let mounted = true;
    async function initUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (!mounted) return;
          setCurrentUser(json.user);
          if (json.user && json.user.id !== creator.id) {
            const followRes = await fetch(`/api/user/follow?targetUserId=${creator.id}`);
            if (followRes.ok) {
              const followData = await followRes.json();
              if (mounted) {
                setIsFollowing(Boolean(followData.isFollowing));
              }
            }
          }
        }
      } catch {}
    }
    initUser();
    return () => {
      mounted = false;
    };
  }, [creator?.id]);

  // 3. 加载该创作者已发布的社区作品
  const fetchPosts = useCallback(async () => {
    if (!creator?.id) return;
    try {
      setLoadingPosts(true);
      const res = await fetch(`/api/community/posts?userId=${creator.id}&limit=50`);
      if (res.ok) {
        const json = await res.json();
        setPosts(json.posts || []);
      }
    } catch (err) {
      console.error('加载作品列表失败:', err);
    } finally {
      setLoadingPosts(false);
    }
  }, [creator?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 4. 处理复制 UID
  const handleCopyUid = useCallback(() => {
    const val = creator?.userNumber || creator?.id;
    if (!val) return;
    navigator.clipboard?.writeText?.(String(val));
    setCopiedUid(true);
    showToast(strings.copiedUid);
    window.setTimeout(() => setCopiedUid(false), 2000);
  }, [creator?.userNumber, creator?.id, strings.copiedUid]);

  // 5. 处理关注/取消关注
  const handleToggleFollow = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (currentUser.id === creator.id) {
      showToast(strings.cannotFollowSelf);
      return;
    }
    setFollowBusy(true);
    try {
      const res = await fetch('/api/user/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: creator.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsFollowing(data.following);
        setFollowersCount((prev) => (data.following ? prev + 1 : Math.max(0, prev - 1)));
        showToast(data.following ? strings.followedSuccess : strings.unfollowedSuccess);
      } else {
        showToast(data.error || strings.actionFailed);
      }
    } catch {
      showToast(strings.networkError);
    } finally {
      setFollowBusy(false);
    }
  };

  if (loadingCreator) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-ink-muted">
        <Loader2 className="size-8 animate-spin text-brand mb-3" />
        <p className="text-caption">{strings.loadingCreator}</p>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center text-ink-muted">
        <p className="text-body-sm font-medium text-ink">{strings.creatorNotFound}</p>
        <p className="mt-1 text-caption">{strings.creatorNotFoundSub}</p>
      </div>
    );
  }

  const isOwner = currentUser && currentUser.id === creator.id;
  const isActivityHiddenForViewer = !isOwner && creator.isActivityPublic === false;

  const content = (
    <div className={`w-full ${className}`}>
      {/* 返回上级 */}
      {showBackLink && (
        <div className="mb-6 sm:mb-8">
          <Link
            href={localizeStudioPath('/community', activeLocale)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>{strings.backToCommunity}</span>
          </Link>
        </div>
      )}

      {/* 创作者头部个人资料区（无框简洁设计） */}
      <UserProfileHeaderCard
        creator={creator}
        currentUser={currentUser}
        isFollowing={isFollowing}
        followersCount={followersCount}
        followBusy={followBusy}
        onToggleFollow={handleToggleFollow}
        onCopyUid={handleCopyUid}
        copiedUid={copiedUid}
        compact={compact}
        locale={activeLocale}
        strings={strings}
        className="mb-8 sm:mb-10"
      />

      {/* Tab 导航切换栏 */}
      <div className="flex items-center gap-6 border-b border-line-subtle mb-6 select-none">
        <button
          type="button"
          onClick={() => setActiveTab('creations')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer relative ${
            activeTab === 'creations'
              ? 'text-ink font-bold'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <span>{strings.tabCreations(posts.length)}</span>
          {activeTab === 'creations' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer relative flex items-center gap-1.5 ${
            activeTab === 'activity'
              ? 'text-ink font-bold'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <span>{strings.tabActivity}</span>
          {isActivityHiddenForViewer && (
            <EyeOff className="size-3 text-amber-400" title={strings.activityHiddenHint} />
          )}
          {activeTab === 'activity' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 内容 1: 我的创作 */}
      {activeTab === 'creations' && (
        <UserProfileCreations
          posts={posts}
          loading={loadingPosts}
          onSelectPost={setSelectedPost}
          columns={compact ? 2 : 4}
          locale={activeLocale}
          strings={strings}
        />
      )}

      {/* Tab 内容 2: 创作活跃度 */}
      {activeTab === 'activity' && (
        <UserProfileActivity
          creator={creator}
          currentUser={currentUser}
          onSwitchToCreations={() => setActiveTab('creations')}
          locale={activeLocale}
          strings={strings}
        />
      )}

      {/* 社区作品详情弹窗 */}
      {selectedPost && (
        <CommunityDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          currentUser={currentUser}
        />
      )}

      {/* 登录/注册弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={async () => {
          setShowAuthModal(false);
          try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
              const json = await res.json();
              setCurrentUser(json.user);
            }
          } catch {}
        }}
      />

      {/* 浮动 Toast 提示 */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-toast flex items-center gap-2 rounded-full border border-line-subtle bg-overlay px-5 py-2 text-xs font-medium text-ink shadow-elevation-4 backdrop-blur-md animate-fade-in"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {showHeader && <StudioHeader />}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {content}
      </main>
    </div>
  );
}
