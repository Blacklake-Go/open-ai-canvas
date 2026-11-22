'use client';

// Adapted from SamurAIGPT/ai-headshot-generator's CreditBadge component.
// Behavior is retained while colors/radius follow the SupDance Studio shell.
export default function CreditBadge({ credits = 0, label = 'Credits', className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 ${className}`}>
      <span className="text-amber-300" aria-hidden="true">◆</span>
      <span>{credits} {label}</span>
    </div>
  );
}
