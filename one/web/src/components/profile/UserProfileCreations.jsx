'use client';

import React from 'react';
import { Sparkles, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';

import { getProfileStrings, useProfileLocale } from './profileI18n';

export default function UserProfileCreations({
  posts = [],
  loading = false,
  onSelectPost,
  columns = 4,
  locale = null,
  strings: stringsProp = null,
}) {
  const activeLocale = useProfileLocale(locale);
  const strings = stringsProp || getProfileStrings(activeLocale);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${columns >= 4 ? 'lg:grid-cols-4' : ''} gap-4 sm:gap-5`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-wash animate-pulse border border-line-subtle" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-16 sm:py-20 flex flex-col items-center justify-center text-center">
        <div className="size-16 rounded-full bg-wash border border-line-subtle flex items-center justify-center text-ink-muted mb-3">
          <Sparkles className="size-8 text-ink-subtle" />
        </div>
        <p className="text-sm font-medium text-ink">{strings.emptyCreationsTitle}</p>
        <p className="text-xs text-ink-muted mt-1">{strings.emptyCreationsSub}</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${columns >= 4 ? 'lg:grid-cols-4' : ''} gap-4 sm:gap-5`}>
      {posts.map((post) => (
        <Card
          key={post.id}
          onClick={() => onSelectPost?.(post)}
          className="group rounded-2xl border border-line-subtle bg-surface-raised overflow-hidden shadow-elevation-1 hover:border-line hover:shadow-elevation-2 transition-all cursor-pointer p-0 flex flex-col"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-black/40">
            {post.media_type === 'video' ? (
              <video
                src={post.media_url}
                className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <img
                src={post.media_url}
                alt={post.title || strings.aiCreation}
                className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 backdrop-blur-md text-white border border-white/10">
              {post.model_name || strings.aiModel}
            </div>
          </div>
          <div className="p-3.5 flex flex-col gap-1.5 flex-1 justify-between">
            <p className="text-xs font-semibold text-ink truncate">{post.title || strings.untitled}</p>
            <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1">
              <span className="flex items-center gap-1">
                <Heart className="size-3 text-red-400 fill-current" />
                <span>{post.likes_count || 0}</span>
              </span>
              <span>{new Date(post.created_at || Date.now()).toLocaleDateString(activeLocale)}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
