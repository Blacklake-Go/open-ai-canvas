'use client';

import React from 'react';
import UnifiedUserAvatar from '@/components/ui/UserAvatar';

// 统一复用全站工业级防破碎用户头像能力
export function UserAvatar({
  src,
  alt,
  letter,
  seed,
  fallbackType = 'letter',
  className = 'size-full object-cover',
  children,
}) {
  const fallbackChild = children !== undefined ? children : (fallbackType === 'letter' && letter ? (
    <span className="select-none">{letter}</span>
  ) : null);

  return (
    <UnifiedUserAvatar
      src={src}
      alt={alt}
      name={letter || alt}
      seed={seed}
      fallbackType={fallbackType}
      className={className}
      fallbackClassName="select-none font-bold"
    >
      {fallbackChild}
    </UnifiedUserAvatar>
  );
}

export default UserAvatar;
