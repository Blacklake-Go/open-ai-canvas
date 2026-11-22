'use client';

import { useState, useEffect, useCallback } from 'react';

let cachedUser = null;
let cachedCredits = null;
let cachedEntitlements = null;
let fetchPromise = null;
let isInitialized = false;

// 同步初始化：从 localStorage 中即时恢复已登录状态与权益方案，杜绝切页时从 null 到真实数据的二次跳闪
function initFromStorage() {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;
  try {
    const stored = localStorage.getItem('ko_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        cachedUser = parsed;
        if (typeof parsed.credits === 'number') {
          cachedCredits = parsed.credits;
        }
      }
    }
    const storedEnt = localStorage.getItem('ko_entitlements');
    if (storedEnt) {
      const parsedEnt = JSON.parse(storedEnt);
      if (parsedEnt && typeof parsedEnt === 'object') {
        cachedEntitlements = parsedEnt;
      }
    }
  } catch {}
}

const listeners = new Set();
function notifyListeners() {
  const currentSnapshot = {
    user: cachedUser,
    credits: cachedCredits,
    entitlements: cachedEntitlements,
  };
  listeners.forEach((listener) => {
    try {
      listener(currentSnapshot);
    } catch {}
  });
}

export function fetchUserSession(force = false) {
  if (fetchPromise && !force) return fetchPromise;

  const runFetch = (retriesLeft = 2) => {
    return fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.user && cachedUser && retriesLeft > 0) {
          // 若本地已存在有效会话用户，但服务端接口暂时未返回用户（可能由于跨进程 cookie 尚未同步完成），延迟重试一次避免误清除
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(runFetch(retriesLeft - 1));
            }, 250);
          });
        }
        fetchPromise = null;
        if (data?.user) {
          cachedUser = data.user;
          cachedCredits = data.entitlements?.credits ?? data.user.credits ?? 0;
          cachedEntitlements = data.entitlements || null;
          try {
            localStorage.setItem('ko_user', JSON.stringify(data.user));
            if (data.user.locale) {
              const norm = data.user.locale;
              localStorage.setItem('NEXT_LOCALE', norm);
              localStorage.setItem('locale', norm);
              const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
              const cookieDomain = hostname.endsWith('.supdance.com')
                ? '; domain=.supdance.com'
                : hostname === 'supdance.com'
                  ? '; domain=.supdance.com'
                  : '';
              document.cookie = `NEXT_LOCALE=${encodeURIComponent(norm)}; path=/; max-age=31536000; SameSite=Lax${cookieDomain}`;
              document.cookie = `locale=${encodeURIComponent(norm)}; path=/; max-age=31536000; SameSite=Lax${cookieDomain}`;
            }
            if (data.user.preferences) {
              localStorage.setItem('supdance_user_preferences', JSON.stringify(data.user.preferences));
            }
            if (data.entitlements) {
              localStorage.setItem('ko_entitlements', JSON.stringify(data.entitlements));
            } else {
              localStorage.removeItem('ko_entitlements');
            }
          } catch {}
        } else {
          cachedUser = null;
          cachedCredits = null;
          cachedEntitlements = null;
          try {
            localStorage.removeItem('ko_user');
            localStorage.removeItem('ko_entitlements');
          } catch {}
        }
        notifyListeners();
        return { user: cachedUser, credits: cachedCredits, entitlements: cachedEntitlements };
      })
      .catch(() => {
        fetchPromise = null;
        return { user: cachedUser, credits: cachedCredits, entitlements: cachedEntitlements };
      });
  };

  fetchPromise = runFetch(2);
  return fetchPromise;
}

/**
 * 全局用户登录态与积分单例 Hook (消除路由切换时的用户状态闪屏)
 * @param {Object|null|undefined} initialUser 服务端注入的初始用户信息（避免客户端水合跳闪）
 */
export function useUserSession(initialUser = undefined) {
  const isServer = typeof window === 'undefined';

  // 1. 客户端初始化与单例缓存（服务端不污染全局模块缓存）
  if (!isServer) {
    initFromStorage();
    if (initialUser !== undefined && initialUser !== null) {
      if (!cachedUser) {
        cachedUser = initialUser;
        if (typeof initialUser.credits === 'number') {
          cachedCredits = initialUser.credits;
        }
      }
    }
  }

  const activeUser = isServer ? (initialUser || null) : (initialUser !== undefined ? initialUser : cachedUser);
  const isPaidUser = Boolean(
    activeUser?.is_subscribed ||
    activeUser?.isSubscribed ||
    (activeUser?.plan_id && String(activeUser.plan_id).toLowerCase() !== 'free')
  );
  const fallbackEntitlements = isPaidUser ? {
    planId: activeUser.plan_id || 'vip',
    planName: String(activeUser.plan_id || 'VIP').toUpperCase(),
    isPaidSubscription: true,
    credits: activeUser?.credits ?? 0,
  } : null;

  if (!isServer && !cachedEntitlements && fallbackEntitlements) {
    cachedEntitlements = fallbackEntitlements;
  }

  const [state, setState] = useState(() => ({
    user: isServer ? (initialUser || null) : (initialUser !== undefined ? initialUser : cachedUser),
    credits: isServer ? (initialUser?.credits ?? null) : (initialUser !== undefined ? (initialUser?.credits ?? null) : cachedCredits),
    entitlements: isServer ? fallbackEntitlements : (cachedEntitlements || fallbackEntitlements),
  }));

  useEffect(() => {
    listeners.add(setState);

    // 挂载时后台静默校验刷新一次
    fetchUserSession();

    // 监听资料与头像即时更新事件总线
    const handleProfileUpdated = (e) => {
      if (e.detail?.user) {
        cachedUser = { ...cachedUser, ...e.detail.user };
        notifyListeners();
      } else if (e.detail?.avatarUrl !== undefined && cachedUser) {
        cachedUser = {
          ...cachedUser,
          avatar_url: e.detail.avatarUrl,
          avatar: e.detail.avatarUrl,
        };
        notifyListeners();
      }
      fetchUserSession(true);
    };

    const handleStorage = (e) => {
      if (e.key === 'ko_user') {
        try {
          cachedUser = e.newValue ? JSON.parse(e.newValue) : null;
          notifyListeners();
        } catch {}
      } else if (e.key === 'ko_entitlements') {
        try {
          cachedEntitlements = e.newValue ? JSON.parse(e.newValue) : null;
          notifyListeners();
        } catch {}
      }
    };

    const handleAuthSuccess = (e) => {
      if (e.detail?.user) {
        cachedUser = e.detail.user;
        if (typeof e.detail.user.credits === 'number') {
          cachedCredits = e.detail.user.credits;
        }
        if (e.detail.entitlements) {
          cachedEntitlements = e.detail.entitlements;
          try {
            localStorage.setItem('ko_entitlements', JSON.stringify(e.detail.entitlements));
          } catch {}
        }
        notifyListeners();
      }
      fetchUserSession(true);
    };

    window.addEventListener('user-profile-updated', handleProfileUpdated);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('supdance-auth-success', handleAuthSuccess);

    return () => {
      listeners.delete(setState);
      window.removeEventListener('user-profile-updated', handleProfileUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('supdance-auth-success', handleAuthSuccess);
    };
  }, []);

  const refresh = useCallback((force = true) => {
    return fetchUserSession(force);
  }, []);

  const mutate = useCallback((updater) => {
    if (typeof updater === 'function') {
      const next = updater({ user: cachedUser, credits: cachedCredits, entitlements: cachedEntitlements });
      if (next.user !== undefined) cachedUser = next.user;
      if (next.credits !== undefined) cachedCredits = next.credits;
      if (next.entitlements !== undefined) cachedEntitlements = next.entitlements;
    } else if (updater && typeof updater === 'object') {
      if (updater.user !== undefined) cachedUser = updater.user;
      if (updater.credits !== undefined) cachedCredits = updater.credits;
      if (updater.entitlements !== undefined) cachedEntitlements = updater.entitlements;
    }
    notifyListeners();
  }, []);

  return {
    user: state.user,
    credits: state.credits,
    entitlements: state.entitlements,
    isPaidUser,
    refresh,
    mutate,
  };
}
