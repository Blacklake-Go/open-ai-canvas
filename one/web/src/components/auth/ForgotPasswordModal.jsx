'use client';

import React from 'react';
import AuthModal from '@/components/AuthModal';

export default function ForgotPasswordModal({
  isOpen = true,
  onClose,
  onSuccess,
  locale = null,
  className = '',
}) {
  return (
    <AuthModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      initialMode="forgot"
      initialEmailMode="reset"
      locale={locale}
      className={className}
    />
  );
}
