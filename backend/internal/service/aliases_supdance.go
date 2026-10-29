package service

import "yingce/backend/internal/app"

const (
	PluginSupDanceI18n            = app.PluginSupDanceI18n
	PluginSupDanceSocialAuth      = app.PluginSupDanceSocialAuth
	PluginSupDanceMusicGeneration = app.PluginSupDanceMusicGeneration
	PluginSupDanceMusicAlias      = app.PluginSupDanceMusicAlias

	MusicLifecycleInstalled   = app.MusicLifecycleInstalled
	MusicLifecycleEnabled     = app.MusicLifecycleEnabled
	MusicLifecycleDraining    = app.MusicLifecycleDraining
	MusicLifecycleDisabled    = app.MusicLifecycleDisabled
	MusicLifecycleUpdating    = app.MusicLifecycleUpdating
	MusicLifecycleError       = app.MusicLifecycleError
	MusicLifecycleUninstalled = app.MusicLifecycleUninstalled
)

type (
	SupDanceI18nSettings        = app.SupDanceI18nSettings
	SupDanceI18nEntry           = app.SupDanceI18nEntry
	SupDanceI18nEntryFilter     = app.SupDanceI18nEntryFilter
	SupDanceI18nEntryListResult = app.SupDanceI18nEntryListResult
	SupDanceI18nPublicBundle    = app.SupDanceI18nPublicBundle
	SupDanceI18nAdminOverview   = app.SupDanceI18nAdminOverview
	SupDanceI18nExportPayload   = app.SupDanceI18nExportPayload

	SocialAuthAdminSettingsView     = app.SocialAuthAdminSettingsView
	SocialAuthSettingsUpdateRequest = app.SocialAuthSettingsUpdateRequest
	SocialAuthProviderTestResult    = app.SocialAuthProviderTestResult
	SocialAuthProvidersPublicView   = app.SocialAuthProvidersPublicView
	SocialAuthLoginResult           = app.SocialAuthLoginResult

	MusicPluginLifecycleState = app.MusicPluginLifecycleState
	MusicLifecycleInfo        = app.MusicLifecycleInfo
	MusicStoredConfig         = app.MusicStoredConfig
	MusicAdminConfigView      = app.MusicAdminConfigView
	MusicUpdateConfigRequest  = app.MusicUpdateConfigRequest
	MusicModelPricingConfig   = app.MusicModelPricingConfig
	MusicGenerationRequest    = app.MusicGenerationRequest
	MusicGenerationResponse   = app.MusicGenerationResponse
	MusicModelCapabilities    = app.MusicModelCapabilities
	SupDanceMusicGeneration   = app.SupDanceMusicGeneration
)

var (
	ValidateMusicLifecycleTransition  = app.ValidateMusicLifecycleTransition
	ResetMusicLifecycleManagerForTest = app.ResetMusicLifecycleManagerForTest
)

