'use client';

import { useRouter } from 'next/navigation';

const PERIODS = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'month', label: '本月' },
];

export default function CostCenterClient({ currentPeriod = '7d' }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => router.push(`/admin/cost-center?period=${p.value}`)}
          className={`inline-flex h-[30px] items-center rounded-lg px-3 text-[11px] font-medium transition-all active:scale-[0.98] ${
            currentPeriod === p.value
              ? 'bg-brand/10 border border-brand/20 text-brand font-semibold'
              : 'border border-white/[0.10] bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
