'use client';

import { getSocialIcon } from '@/components/SocialIcons';
import { providerLabel } from '@/lib/admin/userFilters';

export function ProviderBadge({ provider }) {
  const Icon = getSocialIcon(provider);
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-line bg-wash px-1.5 py-0.5 text-caption font-medium text-ink-muted">
      {Icon && <Icon size={12} />}
      <span>{providerLabel(provider)}</span>
    </span>
  );
}

export function ProviderBadgeList({ providers = [] }) {
  if (!providers?.length) {
    return <span className="text-label text-ink-subtle">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {providers.map((provider) => (
        <ProviderBadge key={provider} provider={provider} />
      ))}
    </div>
  );
}
