'use client';

export { default as AuthModal } from '@/components/AuthModal';
export { default as LoginModal } from './LoginModal';
export { default as RegisterModal } from './RegisterModal';
export { default as ForgotPasswordModal } from './ForgotPasswordModal';
export { default as AuthCard } from './AuthCard';
export { default as EmailLoginView } from './EmailLoginView';
export { default as PhoneLoginView } from './PhoneLoginView';
export { default as RegisterView } from './RegisterView';
export { default as ForgotPasswordView } from './ForgotPasswordView';
export { default as SocialLoginButtons, SOCIAL_PROVIDER_META } from './SocialLoginButtons';
export { default as LoginForm } from './LoginForm';
export { default as RegisterForm } from './RegisterForm';
export { default as ForgotPasswordForm } from './ForgotPasswordForm';
export { default as AuthLayout } from './AuthLayout';
export { default as LoginSuccessOverlay } from './LoginSuccessOverlay';
export { default as LoginSummaryModal } from './LoginSummaryModal';
export { default as UserOnboardingModal } from './UserOnboardingModal';
export { default as DeletionGracePeriodModal } from './DeletionGracePeriodModal';

export { openGlobalAuthModal, closeGlobalAuthModal } from '@/lib/authEvents';
