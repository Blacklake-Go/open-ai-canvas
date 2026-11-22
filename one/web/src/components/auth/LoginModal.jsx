'use client';

import React from 'react';
import AuthModal from '@/components/AuthModal';

export default function LoginModal({
  isOpen = true,
  onClose,
  onSuccess,
  initialTab = 'email',
  locale = null,
  className = '',
}) {
  return (
    <AuthModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      initialMode="login"
      initialEmailMode="login"
      initialTab={initialTab}
      locale={locale}
      className={className}
    />
  );
}
