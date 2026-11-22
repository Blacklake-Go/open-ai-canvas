'use client';

import React from 'react';
import UserProfileView from './UserProfileView';

export default function UserProfileClient({ creator }) {
  return (
    <UserProfileView
      creator={creator}
      showHeader={true}
      showBackLink={true}
      embedded={false}
    />
  );
}
