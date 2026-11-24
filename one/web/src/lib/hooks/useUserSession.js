'use client';

import { useState, useEffect, useCallback } from 'react';

/** @typedef {NonNullable<import('../../services/api/http').AuthMeResponse['user']> & {
 * locale?: string, avatar?: string, avatar_url?: string, preferences?: Record<string, unknown>,
 * is_subscribed?: boolean, isSubscribed?: boolean, plan_id?: string
 * }} SessionUser */
/** @type {{ user: SessionUser | null, credits: number | null, entitlements: Record<string, unknown> | null }} */
let session = { user: null, credits: null, entitlements: null };
let fetchPromise = null;
let revision = 0;
let initialized = false;
const listeners = new Set();

const accountId = (user) => String(user?.id || '');
const sessionUserKey = 'ko_user';
const entitlementsKey = 'ko_entitlements';
const entitlementsOwnerKey = 'ko_entitlements_owner';
const preferencesKey = 'supdance_user_preferences';

function readCachedSession() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const user = JSON.parse(localStorage.getItem(sessionUserKey));
    if (!accountId(user)) return;
    const entitlements = localStorage.getItem(entitlementsOwnerKey) === accountId(user)
      ? JSON.parse(localStorage.getItem(entitlementsKey))
      : null;
    session = { user, credits: entitlements?.credits ?? user.credits ?? null, entitlements };
  } catch {}
}

function storeSession() {
  try {
    const { user, entitlements } = session;
    if (!user) {
      localStorage.removeItem(sessionUserKey);
      localStorage.removeItem(entitlementsKey);
      localStorage.removeItem(entitlementsOwnerKey);
      localStorage.removeItem(preferencesKey);
      return;
    }
    if (entitlements) {
      localStorage.setItem(entitlementsOwnerKey, accountId(user));
      localStorage.setItem(entitlementsKey, JSON.stringify(entitlements));
    } else {
      localStorage.removeItem(entitlementsOwnerKey);
      localStorage.removeItem(entitlementsKey);
    }
    if (user.preferences) localStorage.setItem(preferencesKey, JSON.stringify(user.preferences));
    else localStorage.removeItem(preferencesKey);
    localStorage.setItem(sessionUserKey, JSON.stringify(user));
  } catch {}
}

function publishSession(changes, { persist = true } = {}) {
  const user = changes.user === undefined ? session.user : changes.user;
  const changedOwner = accountId(user) !== accountId(session.user);
  if (changedOwner) revision += 1;
  const base = changedOwner ? { user, credits: user?.credits ?? null, entitlements: null } : session;
  session = {
    user,
    credits: user ? (changes.credits === undefined ? base.credits : changes.credits) : null,
    entitlements: user ? (changes.entitlements === undefined ? base.entitlements : changes.entitlements) : null,
  };
  if (persist) storeSession();
  for (const listener of listeners) listener(session);
}

function syncLocale(locale) {
  if (!locale) return;
  try {
    localStorage.setItem('NEXT_LOCALE', locale);
    localStorage.setItem('locale', locale);
    const domain = /(^|\.)supdance\.com$/.test(window.location.hostname) ? '; domain=.supdance.com' : '';
    document.cookie = `NEXT_LOCALE=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax${domain}`;
    document.cookie = `locale=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax${domain}`;
  } catch {}
}

export function fetchUserSession(force = false) {
  if (fetchPromise && !force) return fetchPromise;
  const requestRevision = ++revision;

  const operation = fetch('/api/auth/me', { cache: 'no-store' })
    .then((response) => {
      if (response.status === 401) return null;
      if (!response.ok) throw new Error('Could not read the current session');
      return response.json();
    })
    .then((data) => {
      if (requestRevision !== revision) return session;
      const user = data?.user || null;
      publishSession({ user, credits: data?.entitlements?.credits ?? user?.credits ?? null, entitlements: data?.entitlements || null });
      syncLocale(user?.locale);
      return session;
    })
    .catch(() => session)
    .finally(() => { if (fetchPromise === operation) fetchPromise = null; });
  fetchPromise = operation;
  return operation;
}

function handleProfileUpdated(event) {
  if (event.detail?.user && session.user &&
      (!event.detail.user.id || accountId(event.detail.user) === accountId(session.user))) {
    publishSession({ user: { ...session.user, ...event.detail.user } });
  } else if (event.detail?.avatarUrl !== undefined && session.user) {
    publishSession({ user: { ...session.user, avatar_url: event.detail.avatarUrl, avatar: event.detail.avatarUrl } });
  }
  void fetchUserSession(true);
}

function handleStorage(event) {
  if (event.key !== sessionUserKey) return;
  try {
    const nextUser = JSON.parse(event.newValue);
    if (accountId(nextUser) === accountId(session.user)) return;
    // A different tab changed the identity. Gate private UI until the cookie is verified.
    publishSession({ user: null }, { persist: false });
    void fetchUserSession(true);
  } catch {}
}

function handleAuthSuccess(event) {
  if (accountId(event.detail?.user)) {
    publishSession({
      user: event.detail.user,
      credits: event.detail.entitlements?.credits ?? event.detail.user.credits,
      entitlements: event.detail.entitlements,
    });
  }
  void fetchUserSession(true);
}

/** @param {SessionUser | null} [initialUser] */
export function useUserSession(initialUser = undefined) {
  readCachedSession();
  const [state, setState] = useState(() => {
    if (initialUser === undefined || accountId(initialUser) === accountId(session.user)) return session;
    return { user: initialUser || null, credits: initialUser?.credits ?? null, entitlements: null };
  });

  useEffect(() => {
    const first = listeners.size === 0;
    listeners.add(setState);
    if (first) {
      window.addEventListener('user-profile-updated', handleProfileUpdated);
      window.addEventListener('storage', handleStorage);
      window.addEventListener('supdance-auth-success', handleAuthSuccess);
    }
    void fetchUserSession();
    return () => {
      listeners.delete(setState);
      if (!listeners.size) {
        window.removeEventListener('user-profile-updated', handleProfileUpdated);
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('supdance-auth-success', handleAuthSuccess);
      }
    };
  }, []);

  const refresh = useCallback((force = true) => fetchUserSession(force), []);
  const mutate = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(session) : updater;
    if (next && typeof next === 'object') publishSession(next);
  }, []);
  const plan = state.entitlements?.planId || state.user?.plan_id;
  const isPaidUser = Boolean(state.user && (
    state.user.is_subscribed || state.user.isSubscribed || (plan && String(plan).toLowerCase() !== 'free')
  ));
  return { ...state, isPaidUser, refresh, mutate };
}
