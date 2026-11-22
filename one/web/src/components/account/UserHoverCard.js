'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Sparkles } from 'lucide-react';
import { avatarFrameClasses } from '@/lib/benefits/catalog';
import UserAvatar from '@/components/ui/UserAvatar';

// 悬浮层只读 /api/user/activity-dashboard：加入天数、称号与三项统计都在那里，
// 不再为一次悬停新开一条后端聚合链路。缓存一份，避免来回移动鼠标反复打接口。
let cached = null;

export default function UserHoverCard({ user }) {
  const [data, setData] = useState(() => (cached && cached.key === user?.id ? cached.data : null));

  useEffect(() => {
    if (!user?.id) return undefined;
    if (cached && cached.key === user.id) {
      setData(cached.data);
      return undefined;
    }
    let active = true;
    fetch('/api/user/activity-dashboard', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        cached = { key: user.id, data: json };
        if (active) setData(json);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => { active = false; };
  }, [user?.id]);

  const profile = data?.user;
  const metrics = data?.metrics;
  const displayName = profile?.displayName || user?.displayName || '创作者';
  const daysActive = profile?.daysActive ?? null;
  const frame = avatarFrameClasses(user?.avatarFrame || user?.avatar_frame);
  const avatarUrl = profile?.avatarUrl || user?.avatar || user?.photo_url || user?.avatar_url || null;
  const stats = [
    { label: '创作作品', value: metrics?.totalCreations },
    { label: '活跃天数', value: metrics?.activeDays },
    { label: '累计积分', value: metrics?.totalCredits },
  ];

  return (
    <div className="w-72 rounded-xl border border-line bg-overlay-glass p-4 shadow-elevation-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className={`flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-body font-semibold text-brand ${frame || 'border border-line'}`}>
          <UserAvatar
            src={avatarUrl}
            name={displayName}
            className="size-full object-cover"
            fallbackClassName="text-sm font-bold text-brand select-none"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-card-title text-ink">{displayName}</p>
          <p className="mt-1 truncate text-caption text-ink-subtle font-mono">UID: {user?.userNumber || user?.id || '—'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-micro text-ink-muted">
          <CalendarClock className="size-3 text-brand" />
          {daysActive === null ? '正在读取加入天数…' : `已加入 ${daysActive} 天`}
        </span>
        {(profile?.badgeTitle || '#探险家') && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success-line bg-success-soft px-2 py-0.5 text-micro text-success">
            <Sparkles className="size-3" />
            {profile?.badgeTitle || '#探险家'}
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-line-subtle bg-surface p-2.5">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 text-center">
            <dt className="truncate text-micro text-ink-subtle">{stat.label}</dt>
            <dd className="mt-0.5 truncate text-label font-semibold tabular-nums text-ink">
              {stat.value === undefined || stat.value === null ? '—' : stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
