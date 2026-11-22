'use client';

import React from 'react';
import NewcomerOnboardingModal from '@/components/onboarding/NewcomerOnboardingModal';

/**
 * 创作者新人入驻画像设定弹窗 (已对齐 Runow 引导交互与 KOYO Studio v3.7 视觉规范)
 */
export default function UserOnboardingModal({ user, locale = 'en', onComplete, onClose }) {
  return (
    <NewcomerOnboardingModal
      user={user}
      locale={locale}
      isPageMode={false}
      onComplete={onComplete}
      onClose={onClose}
    />
  );
}
