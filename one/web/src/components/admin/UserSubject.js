import Link from 'next/link';
import { CopyableId } from './AdminUi';
import { UserAvatar } from '@/components/admin/UserAvatar';

/**
 * 后台所有"这是哪个用户"的单元格统一走这里：以 6 位 UID 为锚点，邮箱作账号说明。
 * 内部 usr_ ID 与昵称不再出现在主体位（两者仍可在用户详情页取到）。
 */
export function UserSubject({ row, href }) {
  const uid = row.user_number || null;
  const letter = (row.email || row.phone || uid || 'U').slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="border-line bg-raised text-brand flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-label font-bold">
        <UserAvatar src={row.avatar_url} alt={uid ? `UID ${uid}` : '用户头像'} letter={letter} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-micro shrink-0 rounded border border-line px-1 py-px text-ink-subtle">UID</span>
          {uid && href ? (
            <Link
              href={href}
              className="font-mono text-body font-semibold text-ink transition hover:text-brand"
              title="进入用户全景画像"
            >
              {uid}
            </Link>
          ) : (
            <CopyableId id={uid} strong />
          )}
        </div>
        <div className="mt-0.5 space-y-0.5 text-caption text-ink-subtle">
          {row.email && <div className="break-all">✉️ {row.email}</div>}
          {row.phone && (
            <div>
              📱 {row.phone_country_code || '+86'} {row.phone}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
