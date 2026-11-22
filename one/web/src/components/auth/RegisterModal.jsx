'use client';

import React from 'react';
import AuthModal from '@/components/AuthModal';

export default function RegisterModal({
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
      initialMode="register"
      initialEmailMode="register"
      locale={locale}
      className={className}
    />
  );
}
