'use client';

import React from 'react';
import { Hash, Copy, Check, Calendar, UserPlus, UserCheck } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';

import { getProfileStrings, useProfileLocale } from './profileI18n';

export default function UserProfileHeaderCard({
  creator,
  currentUser = null,
  isFollowing = false,
  followersCount = 0,
  followBusy = false,
  onToggleFollow,
  onCopyUid,
  copiedUid = false,
  compact = false,
  className = '',
  locale = null,
  strings: stringsProp = null,
}) {
  const activeLocale = useProfileLocale(locale);
  const strings = stringsProp || getProfileStrings(activeLocale);
  if (!creator) return null;

  const isOwner = currentUser && (currentUser.id === creator.id || currentUser.userNumber === creator.userNumber);

  return (
    <div className={`relative ${className}`}>
      <div className={`flex ${compact ? 'flex-col gap-4' : 'flex-col sm:flex-row sm:items-center justify-between gap-6'}`}>
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          {/* 头像 */}
          <div className={`${compact ? 'size-16' : 'size-20 sm:size-24'} rounded-full overflow-hidden bg-wash border-2 border-line-subtle flex items-center justify-center text-2xl font-bold text-brand shrink-0 shadow-elevation-1`}>
            <UserAvatar
              src={creator.avatarUrl}
              name={creator.displayName}
              className="size-full object-cover"
              fallbackClassName="text-2xl font-bold text-brand"
            />
          </div>

          {/* 昵称、UID与简介 */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`${compact ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-ink tracking-tight truncate`}>
                {creator.displayName || strings.creatorDefault}
              </h2>
              <button
                type="button"
                onClick={onCopyUid}
                title={strings.copyUidTitle}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono border border-brand-line/40 bg-brand-soft text-brand hover:bg-brand-soft/80 active:scale-95 transition-all cursor-pointer"
              >
                <Hash className="size-3" />
                <span>UID: {creator.userNumber || creator.id}</span>
                {copiedUid ? <Check className="size-3 ml-0.5" /> : <Copy className="size-3 ml-0.5 opacity-60" />}
              </button>
              {isOwner && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-wash text-ink-muted border border-line-subtle">
                  {strings.myHomepage}
                </span>
              )}
            </div>

            <p className="mt-1.5 text-xs sm:text-sm text-ink-muted max-w-xl leading-relaxed line-clamp-2">
              {creator.bio || strings.defaultBio}
            </p>

            {/* 粉丝与关注数 */}
            <div className="mt-3 flex items-center gap-4 sm:gap-5 text-xs text-ink-muted">
              <div>
                <span className="font-semibold text-ink font-mono">{followersCount}</span> {strings.followers}
              </div>
              <div>
                <span className="font-semibold text-ink font-mono">{creator.followingCount || 0}</span> {strings.following}
              </div>
              <div className="text-[11px] text-ink-subtle flex items-center gap-1 hidden sm:flex">
                <Calendar className="size-3" />
                <span>{strings.joinedDate(new Date(creator.createdAt || Date.now()).toLocaleDateString(activeLocale))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 关注按钮 */}
        {!isOwner && (
          <Button
            type="button"
            variant={isFollowing ? 'secondary' : 'primary'}
            size="md"
            disabled={followBusy}
            onClick={onToggleFollow}
            className={`rounded-full px-5 text-xs font-semibold shrink-0 cursor-pointer self-start sm:self-auto ${
              isFollowing
                ? 'border-line-subtle bg-wash text-ink hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30'
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {isFollowing ? (
              <>
                <UserCheck className="size-3.5 mr-1.5" />
                {strings.followed}
              </>
            ) : (
              <>
                <UserPlus className="size-3.5 mr-1.5" />
                {strings.followCreator}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
