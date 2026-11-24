import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AppProviders } from '@/compat/AppProviders';
import { computeCanonicalRedirect } from '@/router/routes';
import { getCookieLocaleClient } from '@/pages/helpers/pageHelpers';
import GlobalErrorBoundary from '@/pages/boundaries/GlobalErrorBoundary';
import RootErrorBoundary from '@/pages/boundaries/RootErrorBoundary';
import RootNotFound from '@/pages/boundaries/RootNotFound';
import AdminNotFound from '@/pages/boundaries/AdminNotFound';
import AdminLayout from '@/pages/layouts/AdminLayout';
import AgentsLayout from '@/pages/layouts/AgentsLayout';
import DesignSystemLayout from '@/pages/layouts/DesignSystemLayout';

// Lazy helper for named exports
function lazyNamed<T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K
) {
  return lazy(() =>
    loader().then((m) => ({ default: m[exportName] as React.ComponentType<any> }))
  );
}

// Public & Core Pages
const HomePage = lazyNamed(() => import('@/pages/HomePage'), 'HomePage');
const ZhHomePage = lazyNamed(() => import('@/pages/HomePage'), 'ZhHomePage');
const LocalizedHomePage = lazyNamed(() => import('@/pages/HomePage'), 'LocalizedHomePage');

const StudioPage = lazyNamed(() => import('@/pages/StudioPage'), 'StudioPage');

const AssetsPage = lazyNamed(() => import('@/pages/AssetsPage'), 'AssetsPage');
const LocalizedStudioAssetsRedirectPage = lazyNamed(
  () => import('@/pages/AssetsPage'),
  'LocalizedStudioAssetsRedirectPage'
);

const LoginPage = lazyNamed(() => import('@/pages/AuthPages'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('@/pages/AuthPages'), 'RegisterPage');
const ForgotPasswordPage = lazyNamed(() => import('@/pages/AuthPages'), 'ForgotPasswordPage');
const ChangePasswordPage = lazyNamed(() => import('@/pages/AuthPages'), 'ChangePasswordPage');
const ResetPasswordRedirectPage = lazyNamed(() => import('@/pages/AuthPages'), 'ResetPasswordRedirectPage');
const OAuthOnboardingPage = lazyNamed(() => import('@/pages/AuthPages'), 'OAuthOnboardingPage');
const EmbedAuthPage = lazyNamed(() => import('@/pages/AuthPages'), 'EmbedAuthPage');

const LegalPage = lazyNamed(() => import('@/pages/LegalPages'), 'LegalPage');

const ZhCanvasToolsPage = lazyNamed(() => import('@/pages/CanvasToolsAndLabPages'), 'ZhCanvasToolsPage');
const ZhCanvasToolDetailPage = lazyNamed(() => import('@/pages/CanvasToolsAndLabPages'), 'ZhCanvasToolDetailPage');
const CanvasToolsRedirectPage = lazyNamed(() => import('@/pages/CanvasToolsAndLabPages'), 'CanvasToolsRedirectPage');
const ZhLabPage = lazyNamed(() => import('@/pages/CanvasToolsAndLabPages'), 'ZhLabPage');
const LabRedirectPage = lazyNamed(() => import('@/pages/CanvasToolsAndLabPages'), 'LabRedirectPage');

const ModelsPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'ModelsPage');
const ModelDetailPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'ModelDetailPage');
const CommunityPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'CommunityPage');
const CommunityDetailPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'CommunityDetailPage');
const CreationsPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'CreationsPage');
const CoinsPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'CoinsPage');
const CreditsPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'CreditsPage');
const BenefitsPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'BenefitsPage');
const AboutPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AboutPage');
const CallApiPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'CallApiPage');
const FeedbackPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'FeedbackPage');
const ProfilePage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'ProfilePage');
const PublicCreatorProfilePage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'PublicCreatorProfilePage');
const OnboardingPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'OnboardingPage');
const DesignSystemPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'DesignSystemPage');
const WorkflowAliasPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'WorkflowAliasPage');
const AccountRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AccountRedirectPage');
const PricingRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'PricingRedirectPage');
const BillingReturnPage = lazyNamed(() => import('@/pages/BillingOrderPages'), 'BillingReturnPage');
const BillingHistoryPage = lazyNamed(() => import('@/pages/BillingOrderPages'), 'BillingHistoryPage');
const AssistantRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AssistantRedirectPage');
const WorkflowIndexRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'WorkflowIndexRedirectPage');
const AgentsIndexRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AgentsIndexRedirectPage');
const AgentsCreateRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AgentsCreateRedirectPage');
const AgentDetailRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AgentDetailRedirectPage');
const AgentConversationRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AgentConversationRedirectPage');
const AgentEditRedirectPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'AgentEditRedirectPage');
const LocalizedFallbackPage = lazyNamed(() => import('@/pages/PublicFeaturePages'), 'LocalizedFallbackPage');

// Admin Pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminLegacyRedirectPage = lazyNamed(() => import('@/pages/admin/AdminRedirectPages'), 'AdminLegacyRedirectPage');
const AdminRoutingRedirectPage = lazyNamed(() => import('@/pages/admin/AdminRedirectPages'), 'AdminRoutingRedirectPage');
const AdminSystemCatchallRedirectPage = lazyNamed(() => import('@/pages/admin/AdminRedirectPages'), 'AdminSystemCatchallRedirectPage');
const AdminBrandsRedirectPage = lazyNamed(() => import('@/pages/admin/AdminRedirectPages'), 'AdminBrandsRedirectPage');
const AdminPricingRedirectPage = lazyNamed(() => import('@/pages/admin/AdminRedirectPages'), 'AdminPricingRedirectPage');
const AdminForbiddenPage = lazyNamed(() => import('@/pages/admin/AdminRedirectPages'), 'AdminForbiddenPage');

const AdminUsersPage = lazyNamed(() => import('@/pages/admin/AdminUsersPages'), 'AdminUsersPage');
const AdminUserDetailPage = lazyNamed(() => import('@/pages/admin/AdminUsersPages'), 'AdminUserDetailPage');
const AdminUserDashboardPage = lazyNamed(() => import('@/pages/admin/AdminUsersPages'), 'AdminUserDashboardPage');
const AdminAdminsPage = lazyNamed(() => import('@/pages/admin/AdminUsersPages'), 'AdminAdminsPage');
const AdminInvitesPage = lazyNamed(() => import('@/pages/admin/AdminUsersPages'), 'AdminInvitesPage');
const AdminSessionsPage = lazyNamed(() => import('@/pages/admin/AdminUsersPages'), 'AdminSessionsPage');

const AdminOrdersPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminOrdersPage');
const AdminSubscriptionsPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminSubscriptionsPage');
const AdminCreditsPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminCreditsPage');
const AdminCouponsPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminCouponsPage');
const AdminPlansPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminPlansPage');
const AdminSubscriptionFaqPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminSubscriptionFaqPage');
const AdminCostCenterPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminCostCenterPage');
const AdminProfitCenterPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminProfitCenterPage');
const AdminPaymentProvidersPage = lazyNamed(() => import('@/pages/admin/AdminBillingPages'), 'AdminPaymentProvidersPage');

const AdminModelsPage = lazyNamed(() => import('@/pages/admin/AdminModelsPages'), 'AdminModelsPage');
const AdminModelsRoutingPage = lazyNamed(() => import('@/pages/admin/AdminModelsPages'), 'AdminModelsRoutingPage');
const AdminModelsProvidersPage = lazyNamed(() => import('@/pages/admin/AdminModelsPages'), 'AdminModelsProvidersPage');
const AdminModelsPublicationPage = lazyNamed(() => import('@/pages/admin/AdminModelsPages'), 'AdminModelsPublicationPage');
const AdminModelsTelemetryPage = lazyNamed(() => import('@/pages/admin/AdminModelsPages'), 'AdminModelsTelemetryPage');
const AdminModelsCanvasPage = lazyNamed(() => import('@/pages/admin/AdminModelsPages'), 'AdminModelsCanvasPage');
const AdminWorkshopModelsPage = lazy(() => import('@/pages/admin/AdminWorkshopModelsPage'));

const AdminGenerationsPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminGenerationsPage');
const AdminFailedGenerationsPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminFailedGenerationsPage');
const AdminReconciliationPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminReconciliationPage');
const AdminModerationPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminModerationPage');
const AdminAuditPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminAuditPage');
const AdminWebhooksPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminWebhooksPage');
const AdminHealthPage = lazyNamed(() => import('@/pages/admin/AdminGenerationsAndOpsPages'), 'AdminHealthPage');

const AdminCommunityPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminCommunityPage');
const AdminBannerAnalyticsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminBannerAnalyticsPage');
const AdminVisitorsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminVisitorsPage');
const AdminXPromptsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminXPromptsPage');
const AdminFeedbackPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminFeedbackPage');
const AdminFeedbackDetailPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminFeedbackDetailPage');
const AdminI18nPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminI18nPage');
const AdminSettingsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminSettingsPage');
const AdminStorageSettingsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminStorageSettingsPage');
const AdminEmailSettingsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminEmailSettingsPage');
const AdminLoginMethodsPage = lazyNamed(() => import('@/pages/admin/AdminContentAndSystemPages'), 'AdminLoginMethodsPage');

function RouteSuspenseFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: 'var(--bg-canvas, #121214)', color: 'var(--text-primary, #f4f4f6)' }}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[var(--accent-primary,#61d4a7)]" />
    </div>
  );
}

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <RouteSuspenseFallback />;
}

function CanonicalRedirectGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const decision = computeCanonicalRedirect(location.pathname, location.search, {
    cookieLocale: getCookieLocaleClient() || undefined,
  });

  if (decision) {
    if (decision.location.startsWith('http://') || decision.location.startsWith('https://')) {
      return <ExternalRedirect to={decision.location} />;
    }
    return <Navigate to={`${decision.location}${location.hash}`} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <CanonicalRedirectGuard>
      <Suspense fallback={<RouteSuspenseFallback />}>
        <Routes>
          {/* Root & Localized Home */}
          <Route path="/" element={<HomePage />} />
          <Route path="/zh" element={<ZhHomePage />} />
          <Route path="/:locale" element={<LocalizedHomePage />} />

          {/* Studio */}
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/studio/*" element={<StudioPage />} />
          <Route path="/zh/studio" element={<StudioPage forcedLocale="zh-CN" />} />
          <Route path="/zh/studio/*" element={<StudioPage forcedLocale="zh-CN" />} />
          <Route path="/:locale/studio/assets" element={<LocalizedStudioAssetsRedirectPage />} />
          <Route path="/:locale/studio" element={<StudioPage />} />
          <Route path="/:locale/studio/*" element={<StudioPage />} />

          {/* Assets */}
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/zh/assets" element={<AssetsPage forcedLocale="zh-CN" />} />
          <Route path="/:locale/assets" element={<AssetsPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/zh/login" element={<LoginPage forcedLocale="zh-CN" />} />
          <Route path="/:locale/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage locale="en" />} />
          <Route path="/zh/register" element={<RegisterPage locale="zh-CN" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage locale="en" />} />
          <Route path="/zh/forgot-password" element={<ForgotPasswordPage locale="zh-CN" />} />
          <Route path="/change-password" element={<ChangePasswordPage locale="en" />} />
          <Route path="/zh/change-password" element={<ChangePasswordPage locale="zh-CN" />} />
          <Route path="/reset-password" element={<ResetPasswordRedirectPage locale="en" />} />
          <Route path="/zh/reset-password" element={<ResetPasswordRedirectPage locale="zh-CN" />} />
          <Route path="/auth/onboarding" element={<OAuthOnboardingPage />} />
          <Route path="/embed-auth" element={<EmbedAuthPage />} />

          {/* Legal */}
          <Route path="/privacy" element={<LegalPage page="privacy" />} />
          <Route path="/:locale/privacy" element={<LegalPage page="privacy" />} />
          <Route path="/terms" element={<LegalPage page="terms" />} />
          <Route path="/:locale/terms" element={<LegalPage page="terms" />} />
          <Route path="/refund" element={<LegalPage page="refund" />} />
          <Route path="/:locale/refund" element={<LegalPage page="refund" />} />
          <Route path="/content-policy" element={<LegalPage page="contentPolicy" />} />
          <Route path="/:locale/content-policy" element={<LegalPage page="contentPolicy" />} />

          {/* Canvas Tools & Lab */}
          <Route path="/canvas-tools" element={<CanvasToolsRedirectPage />} />
          <Route path="/canvas-tools/*" element={<CanvasToolsRedirectPage />} />
          <Route path="/zh/canvas-tools" element={<ZhCanvasToolsPage />} />
          <Route path="/zh/canvas-tools/*" element={<ZhCanvasToolDetailPage />} />
          <Route path="/lab" element={<LabRedirectPage />} />
          <Route path="/zh/lab" element={<ZhLabPage />} />

          {/* Public Features */}
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/zh/models" element={<ModelsPage forcedLocale="zh-CN" />} />
          <Route path="/models/:id" element={<ModelDetailPage />} />
          <Route path="/zh/models/:id" element={<ModelDetailPage forcedLocale="zh-CN" />} />

          <Route path="/community" element={<CommunityPage />} />
          <Route path="/zh/community" element={<CommunityPage forcedLocale="zh-CN" />} />
          <Route path="/community/:id" element={<CommunityDetailPage />} />
          <Route path="/zh/community/:id" element={<CommunityDetailPage />} />
          <Route path="/ai-tool/work-detail/:id" element={<CommunityDetailPage />} />

          <Route path="/creations" element={<CreationsPage />} />
          <Route path="/coins" element={<CoinsPage />} />
          <Route path="/zh/coins" element={<CoinsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/zh/credits" element={<CreditsPage />} />
          <Route path="/benefits" element={<BenefitsPage />} />
          <Route path="/zh/benefits" element={<BenefitsPage forcedLocale="zh-CN" />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/zh/about" element={<AboutPage forcedLocale="zh-CN" />} />
          <Route path="/call-api" element={<CallApiPage />} />
          <Route path="/zh/call-api" element={<CallApiPage />} />
          <Route path="/:locale/call-api" element={<CallApiPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/zh/profile" element={<ProfilePage forcedLocale="zh-CN" />} />
          <Route path="/u/:id" element={<PublicCreatorProfilePage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Account / Pricing / Assistant / Workflow Redirects */}
          <Route path="/account" element={<AccountRedirectPage />} />
          <Route path="/pricing" element={<PricingRedirectPage locale="en" />} />
          <Route path="/zh/pricing" element={<PricingRedirectPage locale="zh-CN" />} />
          <Route path="/:locale/pricing" element={<PricingRedirectPage />} />
          <Route path="/billing/success" element={<BillingReturnPage />} />
          <Route path="/:locale/billing/success" element={<BillingReturnPage />} />
          <Route path="/billing/orders" element={<BillingHistoryPage />} />
          <Route path="/:locale/billing/orders" element={<BillingHistoryPage />} />
          <Route path="/subscription" element={<PricingRedirectPage locale="en" />} />
          <Route path="/zh/subscription" element={<PricingRedirectPage locale="zh-CN" />} />
          <Route path="/:locale/subscription" element={<PricingRedirectPage />} />
          <Route path="/assistant" element={<AssistantRedirectPage locale="en" />} />
          <Route path="/zh/assistant" element={<AssistantRedirectPage locale="zh-CN" />} />
          <Route path="/workflow" element={<WorkflowIndexRedirectPage locale="en" />} />
          <Route path="/zh/workflow" element={<WorkflowIndexRedirectPage locale="zh-CN" />} />
          <Route path="/workflow/:id" element={<WorkflowAliasPage />} />
          <Route path="/workflow/:id/:tab" element={<WorkflowAliasPage />} />
          <Route path="/:locale/workflow/:id" element={<WorkflowAliasPage />} />
          <Route path="/:locale/workflow/:id/:tab" element={<WorkflowAliasPage />} />

          {/* Design System Layout & Page */}
          <Route element={<DesignSystemLayout />}>
            <Route path="/design-system" element={<DesignSystemPage />} />
          </Route>

          {/* Agents Layout & Legacy Redirects */}
          <Route element={<AgentsLayout />}>
            <Route path="/agents" element={<AgentsIndexRedirectPage />} />
            <Route path="/agents/create" element={<AgentsCreateRedirectPage />} />
            <Route path="/agents/edit/:id" element={<AgentEditRedirectPage />} />
            <Route path="/agents/:agent_id" element={<AgentDetailRedirectPage />} />
            <Route path="/agents/:agent_id/:conversation_id" element={<AgentConversationRedirectPage />} />
          </Route>

          {/* Admin Layout, 66 Pages & Admin Not-Found Boundary */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="forbidden" element={<AdminForbiddenPage />} />

            {/* Users & Access */}
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/dashboard" element={<AdminUserDashboardPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
            <Route path="invites" element={<AdminInvitesPage />} />
            <Route path="security/sessions" element={<AdminSessionsPage />} />

            {/* Billing & Economics */}
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="credits" element={<AdminCreditsPage />} />
            <Route path="coupons" element={<AdminCouponsPage />} />
            <Route path="plans" element={<AdminPlansPage />} />
            <Route path="subscription-faq" element={<AdminSubscriptionFaqPage />} />
            <Route path="cost-center" element={<AdminCostCenterPage />} />
            <Route path="profit-center" element={<AdminProfitCenterPage />} />
            <Route path="providers/payments" element={<AdminPaymentProvidersPage />} />

            {/* Models & Routing */}
            <Route path="models" element={<AdminModelsPage />} />
            <Route path="models/routing" element={<AdminModelsRoutingPage />} />
            <Route path="models/providers" element={<AdminModelsProvidersPage />} />
            <Route path="models/publication" element={<AdminModelsPublicationPage />} />
            <Route path="models/telemetry" element={<AdminModelsTelemetryPage />} />
            <Route path="models/canvas" element={<AdminModelsCanvasPage />} />
            <Route path="models/workshop" element={<AdminWorkshopModelsPage />} />
            <Route path="models/brands" element={<AdminBrandsRedirectPage />} />
            <Route path="models/pricing" element={<AdminPricingRedirectPage />} />
            <Route path="models/catalog" element={<AdminLegacyRedirectPage to="/admin/models/providers" preserveQuery={false} requiredPermission="models.read" />} />
            <Route path="models/health" element={<AdminLegacyRedirectPage to="/admin/models/providers" preserveQuery={false} requiredPermission="models.read" />} />
            <Route path="models/cost-center" element={<AdminLegacyRedirectPage to="/admin/cost-center" />} />
            <Route path="models/frontend" element={<AdminLegacyRedirectPage to="/admin/models" />} />
            <Route path="models/profit-center" element={<AdminLegacyRedirectPage to="/admin/profit-center" />} />
            <Route path="models/registry" element={<AdminLegacyRedirectPage to="/admin/models?tab=models" />} />
            <Route path="routing" element={<AdminLegacyRedirectPage to="/admin/models/routing" />} />
            <Route path="routing/:modelId" element={<AdminRoutingRedirectPage />} />

            {/* Providers & Legacy System Redirects */}
            <Route path="providers" element={<AdminLegacyRedirectPage to="/admin/models/providers" />} />
            <Route path="providers/ai" element={<AdminLegacyRedirectPage to="/admin/models/providers" />} />
            <Route path="providers/models" element={<AdminLegacyRedirectPage to="/admin/models/routing" />} />
            <Route path="providers/email" element={<AdminLegacyRedirectPage to="/admin/system/email" />} />
            <Route path="providers/sms" element={<AdminLegacyRedirectPage to="/admin/system/login?category=sms" />} />
            <Route path="providers/social" element={<AdminLegacyRedirectPage to="/admin/system/login?category=social" />} />
            <Route path="email" element={<AdminLegacyRedirectPage to="/admin/system?tab=email" />} />
            <Route path="login" element={<AdminLegacyRedirectPage to="/admin/system?tab=login" />} />
            <Route path="system" element={<AdminSystemCatchallRedirectPage />} />
            <Route path="system/email" element={<AdminEmailSettingsPage />} />
            <Route path="system/login" element={<AdminLoginMethodsPage />} />

            {/* Generations & Operations */}
            <Route path="generations" element={<AdminGenerationsPage />} />
            <Route path="generations/failures" element={<AdminFailedGenerationsPage />} />
            <Route path="generations/reconciliation" element={<AdminReconciliationPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="webhooks" element={<AdminWebhooksPage />} />
            <Route path="health" element={<AdminHealthPage />} />

            {/* Content & Settings */}
            <Route path="community" element={<AdminCommunityPage />} />
            <Route path="content/analytics" element={<AdminBannerAnalyticsPage />} />
            <Route path="content/banners" element={<AdminLegacyRedirectPage to="/admin/settings?tab=banner" preserveQuery={false} requiredPermission="settings.read" />} />
            <Route path="content/branding" element={<AdminLegacyRedirectPage to="/admin/settings?tab=branding" preserveQuery={false} requiredPermission="settings.read" />} />
            <Route path="content/effects" element={<AdminLegacyRedirectPage to="/admin/settings?tab=motion" preserveQuery={false} requiredPermission="settings.read" />} />
            <Route path="content/icon" element={<AdminLegacyRedirectPage to="/admin/settings?tab=branding#icon-settings" preserveQuery={false} requiredPermission="settings.read" />} />
            <Route path="content/visitors" element={<AdminVisitorsPage />} />
            <Route path="content/x-prompts" element={<AdminXPromptsPage />} />
            <Route path="visitors" element={<AdminLegacyRedirectPage to="/admin/content/visitors" preserveQuery={false} requiredPermission="users.read" />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="feedback/:id" element={<AdminFeedbackDetailPage />} />
            <Route path="i18n" element={<AdminI18nPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="settings/appearance" element={<AdminLegacyRedirectPage to="/admin/settings?tab=motion" preserveQuery={false} requiredPermission="settings.read" />} />
            <Route path="settings/storage" element={<AdminStorageSettingsPage />} />
            <Route path="storage" element={<AdminLegacyRedirectPage to="/admin/settings/storage" preserveQuery={false} requiredPermission="storage.read" />} />

            {/* Admin 404 */}
            <Route path="*" element={<AdminNotFound />} />
          </Route>

          {/* Dynamic Locale Catchall & Root 404 */}
          <Route path="/:locale/*" element={<LocalizedFallbackPage />} />
          <Route path="*" element={<RootNotFound />} />
        </Routes>
      </Suspense>
    </CanonicalRedirectGuard>
  );
}

export function App() {
  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <RootErrorBoundary>
            <AppRoutes />
          </RootErrorBoundary>
        </AppProviders>
      </BrowserRouter>
    </GlobalErrorBoundary>
  );
}

export default App;
