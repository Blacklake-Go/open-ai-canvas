'use client';

export { default as AccountModal } from './AccountModal';
export { default as AccountCenterView } from './AccountCenterView';
export { default as AccountSettingsView } from './AccountSettingsView';
export { default as AccountSettingsModal } from './AccountSettingsModal';
export { default as AccountLayout, normalizeTab, NAV_ITEMS } from './AccountLayout';
export { default as RechargeModal } from './RechargeModal';
export { default as RateCardModal } from './RateCardModal';
export { default as UserHoverCard } from './UserHoverCard';
export { default as DualCurrencyCards } from './DualCurrencyCards';

// Tabs & Settings Sections
export { default as ProfileTab } from './tabs/ProfileTab';
export { default as SettingsTab } from './tabs/SettingsTab';
export { default as ActivityTab } from './tabs/ActivityTab';
export { default as MembershipTab } from './tabs/MembershipTab';
export { default as UsageTab } from './tabs/UsageTab';
export { default as SystemPreferencesSection } from './settings/SystemPreferencesSection';

export { openGlobalAccountModal, openGlobalSubscriptionModal } from '@/lib/accountEvents';
