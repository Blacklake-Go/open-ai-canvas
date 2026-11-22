'use client';

import React from 'react';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ActivityTab from '@/components/account/tabs/ActivityTab';

import { getProfileStrings, useProfileLocale } from './profileI18n';

export default function UserProfileActivity({
  creator,
  currentUser = null,
  onSwitchToCreations,
  locale = null,
  strings: stringsProp = null,
}) {
  const activeLocale = useProfileLocale(locale);
  const strings = stringsProp || getProfileStrings(activeLocale);

  if (!creator) return null;

  const isOwner = currentUser && (currentUser.id === creator.id || currentUser.userNumber === creator.userNumber);
  const isActivityHiddenForViewer = !isOwner && creator.isActivityPublic === false;

  if (isActivityHiddenForViewer) {
    return (
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-8 sm:p-12 text-center flex flex-col items-center justify-center">
        <div className="size-12 rounded-full bg-wash border border-line-subtle flex items-center justify-center text-amber-400 mb-3">
          <EyeOff className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-ink">{strings.privateTitle}</h3>
        <p className="text-xs text-ink-muted mt-1 max-w-md leading-relaxed">
          {strings.privateDesc}
        </p>
        {onSwitchToCreations && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSwitchToCreations}
            className="mt-5 rounded-full px-5 text-xs font-semibold cursor-pointer"
          >
            {strings.browsePublic}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {isOwner && creator.isActivityPublic === false && (
        <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
          <EyeOff className="size-4 shrink-0" />
          <span>{strings.ownerPrivateNotice}</span>
        </div>
      )}
      <ActivityTab user={creator} />
    </div>
  );
}
