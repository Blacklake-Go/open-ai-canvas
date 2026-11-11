package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"
)

const (
	PluginSupDanceHtmlPageManager = "supdance-html-page-manager"
	HtmlPagesSettingKey           = "plugin.supdance-html-page-manager.pages"
	HtmlSiteFooterSettingKey      = "plugin.supdance-html-page-manager.site_footer"
)

func init() {
	officialApplicationPolicies[PluginSupDanceHtmlPageManager] = PluginManagementView{
		Origin:             PluginOriginOfficial,
		Kind:               PluginKindApplication,
		ActivationScope:    PluginScopeSystem,
		ConfigurationScope: PluginConfigurationSystem,
	}
}

// HtmlPageItem 代表一个受管的 HTML 页面
type HtmlPageItem struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	TemplateID  string    `json:"templateId"`
	HTML        string    `json:"html"`
	IsPublished bool      `json:"isPublished"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// HtmlManagedSitePage 代表一个受管的站点法务/公开路由页面及页脚开关
type HtmlManagedSitePage struct {
	Path        string `json:"path"`
	Title       string `json:"title"`
	Description string `json:"description"`
	PageType    string `json:"pageType"` // "spa" | "static-html"
	ShowFooter  bool   `json:"showFooter"`
}

type HtmlFooterSocialLink struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Handle string `json:"handle"`
	Href   string `json:"href"`
}

type HtmlFooterLinkItem struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type HtmlFooterLinkColumn struct {
	Title string               `json:"title"`
	Links []HtmlFooterLinkItem `json:"links"`
}

// HtmlSiteFooterConfig 代表页脚管理器与页面管理的持久化配置
type HtmlSiteFooterConfig struct {
	Enabled              bool                   `json:"enabled"`
	BrandName            string                 `json:"brandName"`
	BrandSlogan          string                 `json:"brandSlogan"`
	BrandVision          string                 `json:"brandVision"`
	SupportEmail         string                 `json:"supportEmail"`
	OfficialChannelsText string                 `json:"officialChannelsText"`
	SocialLinks          []HtmlFooterSocialLink `json:"socialLinks"`
	Columns              []HtmlFooterLinkColumn `json:"columns"`
	NewsletterHeading    string                 `json:"newsletterHeading"`
	NewsletterDesc       string                 `json:"newsletterDesc"`
	NewsletterCardTitle  string                 `json:"newsletterCardTitle"`
	NewsletterCardDesc   string                 `json:"newsletterCardDesc"`
	NewsletterActionText string                 `json:"newsletterActionText"`
	NewsletterActionHref string                 `json:"newsletterActionHref"`
	LegalLinks           []HtmlFooterLinkItem   `json:"legalLinks"`
	CopyrightText        string                 `json:"copyrightText"`
	IcpNumber            string                 `json:"icpNumber"`
	IcpHref              string                 `json:"icpHref"`
	OperatingSystemText  string                 `json:"operatingSystemText"`
	StatusPrimaryText    string                 `json:"statusPrimaryText"`
	StatusSecondaryText  string                 `json:"statusSecondaryText"`
	SitePages            []HtmlManagedSitePage  `json:"sitePages"`
	UpdatedAt            time.Time              `json:"updatedAt"`
	UpdatedBy            string                 `json:"updatedBy,omitempty"`
}

type HtmlPagesStorePayload struct {
	Pages     []HtmlPageItem `json:"pages"`
	UpdatedAt time.Time      `json:"updatedAt"`
	UpdatedBy string         `json:"updatedBy,omitempty"`
}

type HtmlPagesAdminOverview struct {
	PluginID   string               `json:"pluginId"`
	Available  bool                 `json:"available"`
	Pages      []HtmlPageItem       `json:"pages"`
	SiteFooter HtmlSiteFooterConfig `json:"siteFooter"`
	UpdatedAt  time.Time            `json:"updatedAt"`
}

var defaultPagesMutex sync.RWMutex

// HtmlPageManagerPluginAvailable 检查插件是否在平台开放
func (s *Service) HtmlPageManagerPluginAvailable() (bool, error) {
	if s.repo == nil {
		return false, fmt.Errorf("存储不可用")
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceHtmlPageManager)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

// PublicHtmlPages 获取当前已发布的页面列表
func (s *Service) PublicHtmlPages() ([]HtmlPageItem, error) {
	available, err := s.HtmlPageManagerPluginAvailable()
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, errors.New("HTML 页面管理插件未启用")
	}
	pages, err := s.readStoredPages()
	if err != nil {
		return nil, err
	}
	var published []HtmlPageItem
	for _, p := range pages {
		if p.IsPublished {
			published = append(published, p)
		}
	}
	return published, nil
}

// PublicHtmlPageBySlug 按 slug 获取单个公开页面
func (s *Service) PublicHtmlPageBySlug(slug string) (*HtmlPageItem, error) {
	slug = strings.TrimSpace(slug)
	pages, err := s.PublicHtmlPages()
	if err != nil {
		return nil, err
	}
	for _, p := range pages {
		if strings.EqualFold(p.Slug, slug) {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("页面 %s 不存在或未发布", slug)
}

// PublicHtmlSiteFooterConfig 获取公开的页脚与受管页面配置（免登录，读展示路径降级兜底）
func (s *Service) PublicHtmlSiteFooterConfig() (*HtmlSiteFooterConfig, error) {
	cfg, err := s.readStoredSiteFooterConfig()
	if err != nil {
		fallback := DefaultHtmlSiteFooterConfig()
		return &fallback, nil
	}
	return &cfg, nil
}

// AdminHtmlPagesOverview 获取管理总览（需要管理员权限）
func (s *Service) AdminHtmlPagesOverview(actor *model.User) (*HtmlPagesAdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	available, err := s.HtmlPageManagerPluginAvailable()
	if err != nil {
		return nil, err
	}
	pages, err := s.readStoredPages()
	if err != nil {
		return nil, err
	}
	siteFooter, err := s.readStoredSiteFooterConfig()
	if err != nil {
		siteFooter = DefaultHtmlSiteFooterConfig()
	}
	return &HtmlPagesAdminOverview{
		PluginID:   PluginSupDanceHtmlPageManager,
		Available:  available,
		Pages:      pages,
		SiteFooter: siteFooter,
		UpdatedAt:  time.Now(),
	}, nil
}

// AdminSaveHtmlSiteFooter 保存或更新页脚与站点页面配置（需要管理员权限）
func (s *Service) AdminSaveHtmlSiteFooter(actor *model.User, cfg HtmlSiteFooterConfig) (*HtmlPagesAdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return nil, errors.New("存储不可用")
	}

	now := time.Now()
	normalized := normalizeHtmlSiteFooterConfig(cfg)
	normalized.UpdatedAt = now
	normalized.UpdatedBy = actor.ID

	val, err := json.Marshal(normalized)
	if err != nil {
		return nil, fmt.Errorf("序列化页脚配置失败: %w", err)
	}

	setting := &model.SystemSetting{
		Key:       HtmlSiteFooterSettingKey,
		ValueJSON: string(val),
		UpdatedBy: actor.ID,
		UpdatedAt: now,
	}
	if err := s.repo.SaveSystemSetting(setting); err != nil {
		return nil, fmt.Errorf("保存页脚配置失败: %w", err)
	}

	return s.AdminHtmlPagesOverview(actor)
}

// AdminResetHtmlSiteFooter 重置页脚与站点页面配置为官方默认
func (s *Service) AdminResetHtmlSiteFooter(actor *model.User) (*HtmlPagesAdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	defaults := DefaultHtmlSiteFooterConfig()
	return s.AdminSaveHtmlSiteFooter(actor, defaults)
}

func (s *Service) readStoredSiteFooterConfig() (HtmlSiteFooterConfig, error) {
	if s.repo == nil {
		return DefaultHtmlSiteFooterConfig(), nil
	}
	setting, err := s.repo.SystemSettingOptional(HtmlSiteFooterSettingKey)
	if err != nil {
		return DefaultHtmlSiteFooterConfig(), err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return DefaultHtmlSiteFooterConfig(), nil
	}
	var cfg HtmlSiteFooterConfig
	if err := json.Unmarshal([]byte(setting.ValueJSON), &cfg); err != nil {
		return DefaultHtmlSiteFooterConfig(), nil
	}
	return normalizeHtmlSiteFooterConfig(cfg), nil
}

func normalizeHtmlSiteFooterConfig(cfg HtmlSiteFooterConfig) HtmlSiteFooterConfig {
	def := DefaultHtmlSiteFooterConfig()
	if strings.TrimSpace(cfg.BrandName) == "" {
		cfg.BrandName = def.BrandName
	}
	if strings.TrimSpace(cfg.BrandSlogan) == "" {
		cfg.BrandSlogan = def.BrandSlogan
	}
	if strings.TrimSpace(cfg.BrandVision) == "" {
		cfg.BrandVision = def.BrandVision
	}
	if strings.TrimSpace(cfg.SupportEmail) == "" {
		cfg.SupportEmail = def.SupportEmail
	}
	if strings.TrimSpace(cfg.OfficialChannelsText) == "" {
		cfg.OfficialChannelsText = def.OfficialChannelsText
	}
	if len(cfg.SocialLinks) == 0 {
		cfg.SocialLinks = def.SocialLinks
	}
	if len(cfg.Columns) == 0 {
		cfg.Columns = def.Columns
	}
	if strings.TrimSpace(cfg.NewsletterHeading) == "" {
		cfg.NewsletterHeading = def.NewsletterHeading
	}
	if strings.TrimSpace(cfg.NewsletterDesc) == "" {
		cfg.NewsletterDesc = def.NewsletterDesc
	}
	if strings.TrimSpace(cfg.NewsletterCardTitle) == "" {
		cfg.NewsletterCardTitle = def.NewsletterCardTitle
	}
	if strings.TrimSpace(cfg.NewsletterCardDesc) == "" {
		cfg.NewsletterCardDesc = def.NewsletterCardDesc
	}
	if strings.TrimSpace(cfg.NewsletterActionText) == "" {
		cfg.NewsletterActionText = def.NewsletterActionText
	}
	if strings.TrimSpace(cfg.NewsletterActionHref) == "" {
		cfg.NewsletterActionHref = def.NewsletterActionHref
	}
	if len(cfg.LegalLinks) == 0 {
		cfg.LegalLinks = def.LegalLinks
	}
	if strings.TrimSpace(cfg.CopyrightText) == "" {
		cfg.CopyrightText = def.CopyrightText
	}
	if strings.TrimSpace(cfg.IcpNumber) == "" {
		cfg.IcpNumber = def.IcpNumber
	}
	if strings.TrimSpace(cfg.IcpHref) == "" {
		cfg.IcpHref = def.IcpHref
	}
	if strings.TrimSpace(cfg.OperatingSystemText) == "" {
		cfg.OperatingSystemText = def.OperatingSystemText
	}
	if strings.TrimSpace(cfg.StatusPrimaryText) == "" {
		cfg.StatusPrimaryText = def.StatusPrimaryText
	}
	if strings.TrimSpace(cfg.StatusSecondaryText) == "" {
		cfg.StatusSecondaryText = def.StatusSecondaryText
	}
	if len(cfg.SitePages) == 0 {
		cfg.SitePages = def.SitePages
	}
	return cfg
}

// DefaultHtmlSiteFooterConfig 提供与 one.supdance.com/zh/about 红框页脚完全对齐的默认配置
func DefaultHtmlSiteFooterConfig() HtmlSiteFooterConfig {
	now := time.Now()
	return HtmlSiteFooterConfig{
		Enabled:              true,
		BrandName:            "supdance",
		BrandSlogan:          "AI 创意工作室",
		BrandVision:          "面向创作者、独立工作室与团队的专业生成式 AI 创作工作台与模型接入层，支持模型发现、生成与工作流协作。",
		SupportEmail:         "support@supdance.com",
		OfficialChannelsText: "官方社交媒体与社区",
		SocialLinks: []HtmlFooterSocialLink{
			{ID: "x", Name: "X (Twitter)", Handle: "@supdance_ai", Href: "https://x.com/supdance_ai"},
			{ID: "youtube", Name: "YouTube", Handle: "SupDance AI", Href: "https://www.youtube.com/channel/UCOoro6d-vr6M-1UIpP5POew"},
			{ID: "instagram", Name: "Instagram", Handle: "@supdance_com", Href: "https://www.instagram.com/supdance_com/"},
			{ID: "xiaohongshu", Name: "小红书 (RED)", Handle: "SupDance", Href: "https://www.xiaohongshu.com/search_result?keyword=SupDance"},
			{ID: "qq", Name: "QQ 交流群", Handle: "SupDance 官方群", Href: "https://qm.qq.com/q/e8alJlLDuE"},
		},
		Columns: []HtmlFooterLinkColumn{
			{
				Title: "创意工作台",
				Links: []HtmlFooterLinkItem{
					{Label: "图像生图工坊", Href: "https://one.supdance.com/zh/studio?tab=image"},
					{Label: "视频运镜导演台", Href: "https://one.supdance.com/zh/studio?tab=video"},
					{Label: "音频音乐工作台", Href: "https://one.supdance.com/zh/studio?tab=audio"},
					{Label: "节点式工作流", Href: "https://one.supdance.com/zh/workflow"},
					{Label: "会员订阅方案", Href: "https://one.supdance.com/zh/pricing"},
				},
			},
			{
				Title: "开发者与遥测",
				Links: []HtmlFooterLinkItem{
					{Label: "开放平台（筹备中）", Href: "https://one.supdance.com/zh/call-api"},
					{Label: "模型目录与真实调用", Href: "https://one.supdance.com/zh/about#models"},
					{Label: "创作者案例广场", Href: "https://one.supdance.com/zh/community"},
					{Label: "创作者算力权益", Href: "https://one.supdance.com/zh/benefits"},
				},
			},
		},
		NewsletterHeading:    "模型技术周刊与通知",
		NewsletterDesc:       "订阅 supdance 技术周报，第一时间获取模型与产品更新公告。",
		NewsletterCardTitle:  "邮件订阅即将开放",
		NewsletterCardDesc:   "目前还没有可用的邮件订阅服务。欢迎先加入社区获取模型与产品更新。",
		NewsletterActionText: "前往社区",
		NewsletterActionHref: "https://one.supdance.com/zh/community",
		LegalLinks: []HtmlFooterLinkItem{
			{Label: "隐私政策", Href: "/privacy"},
			{Label: "服务条款", Href: "/terms"},
			{Label: "退款准则", Href: "/aup"},
			{Label: "内容安全", Href: "/legal"},
		},
		CopyrightText:       "© 2026 supdance (supdance.com). 保留所有权利。",
		IcpNumber:           "备案编号：沪ICP备2026050086号",
		IcpHref:             "https://beian.miit.gov.cn/",
		OperatingSystemText: "新一代生成式 AI 创意工作系统",
		StatusPrimaryText:   "高精创作画布内核",
		StatusSecondaryText: "模型网关中枢",
		SitePages: []HtmlManagedSitePage{
			{Path: "/terms", Title: "服务条款 (Terms of Service)", Description: "平台服务协议、积分即时交付与退款保障条款", PageType: "spa", ShowFooter: true},
			{Path: "/privacy", Title: "隐私政策 (Privacy Policy)", Description: "个人信息收集范围、GDPR/CCPA 与数据安全保护", PageType: "spa", ShowFooter: true},
			{Path: "/aup", Title: "可接受使用政策 (Acceptable Use Policy)", Description: "AI 生成内容合规底线、举报机制与安全处置", PageType: "spa", ShowFooter: true},
			{Path: "/legal", Title: "法务与合规中心 (Legal Hub)", Description: "法律协议总览入口与经营主体公示", PageType: "spa", ShowFooter: true},
			{Path: "/mcp", Title: "MCP 协议与插件生态 (MCP Center)", Description: "开源 MCP 工具清单、CLI 安装指南与插件市场", PageType: "spa", ShowFooter: true},
			{Path: "/pricing.html", Title: "公开价目表 (Pricing HTML)", Description: "积分套餐、云存储与全量 AI 模型参考价目表", PageType: "static-html", ShowFooter: true},
		},
		UpdatedAt: now,
	}
}

// AdminSaveHtmlPages 保存或更新页面列表（需要管理员权限）
func (s *Service) AdminSaveHtmlPages(actor *model.User, pages []HtmlPageItem) (*HtmlPagesAdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return nil, errors.New("存储不可用")
	}

	now := time.Now()
	for i := range pages {
		if strings.TrimSpace(pages[i].ID) == "" {
			pages[i].ID = fmt.Sprintf("page-%d", now.UnixNano()+int64(i))
		}
		pages[i].Slug = strings.ToLower(strings.TrimSpace(pages[i].Slug))
		pages[i].UpdatedAt = now
	}

	payload := HtmlPagesStorePayload{
		Pages:     pages,
		UpdatedAt: now,
		UpdatedBy: actor.ID,
	}
	val, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("序列化页面数据失败: %w", err)
	}

	setting := &model.SystemSetting{
		Key:       HtmlPagesSettingKey,
		ValueJSON: string(val),
		UpdatedBy: actor.ID,
		UpdatedAt: now,
	}
	if err := s.repo.SaveSystemSetting(setting); err != nil {
		return nil, fmt.Errorf("保存页面配置失败: %w", err)
	}

	return s.AdminHtmlPagesOverview(actor)
}

// AdminResetHtmlPages 重置为初始高质感模板页面
func (s *Service) AdminResetHtmlPages(actor *model.User) (*HtmlPagesAdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	defaults := defaultBuiltinHtmlPages()
	return s.AdminSaveHtmlPages(actor, defaults)
}

func (s *Service) readStoredPages() ([]HtmlPageItem, error) {
	if s.repo == nil {
		return defaultBuiltinHtmlPages(), nil
	}
	setting, err := s.repo.SystemSettingOptional(HtmlPagesSettingKey)
	if err != nil {
		return nil, err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaultBuiltinHtmlPages(), nil
	}
	var payload HtmlPagesStorePayload
	if err := json.Unmarshal([]byte(setting.ValueJSON), &payload); err != nil {
		return defaultBuiltinHtmlPages(), nil
	}
	if len(payload.Pages) == 0 {
		return defaultBuiltinHtmlPages(), nil
	}
	return payload.Pages, nil
}

// defaultBuiltinHtmlPages 提供内置的 4 套开箱即用的大气简洁法务条款页面
func defaultBuiltinHtmlPages() []HtmlPageItem {
	defaultPagesMutex.RLock()
	defer defaultPagesMutex.RUnlock()

	now := time.Now()
	return []HtmlPageItem{
		{
			ID:          "page-terms-linear",
			Slug:        "terms",
			Title:       "服务条款",
			Description: "Linear 极简大气黑夜风 · 纯粹通透、舒缓行高与精致排版（推荐作为主条款页）",
			TemplateID:  "linear-dark",
			HTML:        defaultLinearTermsHtml,
			IsPublished: true,
			UpdatedAt:   now,
		},
		{
			ID:          "page-privacy-vercel",
			Slug:        "privacy",
			Title:       "隐私政策",
			Description: "Vercel 结构化文档风 · 左侧吸顶目录、阅读进度条与数据披露表格",
			TemplateID:  "vercel-doc",
			HTML:        defaultVercelPrivacyHtml,
			IsPublished: true,
			UpdatedAt:   now,
		},
		{
			ID:          "page-aup-linear",
			Slug:        "aup",
			Title:       "可接受使用政策",
			Description: "Linear 极简黑夜风 · 涵盖内容标准、审核机制、举报通道与违规处置行动",
			TemplateID:  "linear-dark",
			HTML:        defaultLinearAupHtml,
			IsPublished: true,
			UpdatedAt:   now,
		},
		{
			ID:          "page-legal-hub",
			Slug:        "legal",
			Title:       "法务与合规中心",
			Description: "Anthropic 法律中心总览风 · 卡片式阵列、受众标签与即时搜索入口",
			TemplateID:  "anthropic-hub",
			HTML:        defaultAnthropicLegalHubHtml,
			IsPublished: true,
			UpdatedAt:   now,
		},
		{
			ID:          "page-refund-supabase",
			Slug:        "refund",
			Title:       "退款与争议处理政策",
			Description: "Supabase 现代纸书单栏风 · 居中舒适阅读宽度与条款跳跃锚点",
			TemplateID:  "supabase-clean",
			HTML:        defaultSupabaseRefundHtml,
			IsPublished: true,
			UpdatedAt:   now,
		},
	}
}

const defaultLinearTermsHtml = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Terms of Service · 服务条款</title>
  <style>
    :root, html[data-theme="dark"] {
      --bg: #000000;
      --fg: #ffffff;
      --fg-muted: #8a8f98;
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(255, 255, 255, 0.2);
      --header-bg: rgba(0, 0, 0, 0.85);
      --card-bg: rgba(255, 255, 255, 0.03);
      --accent: #5e6ad2;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    html[data-theme="light"] {
      --bg: #ffffff;
      --fg: #111111;
      --fg-muted: #666666;
      --border: rgba(0, 0, 0, 0.08);
      --border-focus: rgba(0, 0, 0, 0.2);
      --header-bg: rgba(255, 255, 255, 0.85);
      --card-bg: rgba(0, 0, 0, 0.02);
      --accent: #5e6ad2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.8;
      letter-spacing: -0.011em;
      -webkit-font-smoothing: antialiased;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(20px, 4vw, 48px);
      height: 64px;
      background: var(--header-bg);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.02em;
      color: var(--fg);
      text-decoration: none;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--fg);
      color: var(--bg);
      font-size: 12px;
      font-weight: 700;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-link {
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s ease;
    }
    .nav-link:hover { color: var(--fg); }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: clamp(32px, 6vw, 72px) 24px clamp(64px, 8vw, 120px);
    }
    h1 {
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 600;
      letter-spacing: -0.035em;
      line-height: 1.1;
      margin-bottom: 12px;
    }
    .meta {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-top: 48px;
      margin-bottom: 16px;
      color: var(--fg);
    }
    p {
      color: var(--fg-muted);
      margin-bottom: 20px;
    }
    ul, ol {
      margin: 16px 0 24px 20px;
      color: var(--fg-muted);
    }
    li { margin-bottom: 8px; }
    .callout {
      margin: 32px 0;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      color: var(--fg);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 13px;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      font-family: var(--font-mono);
      font-weight: 500;
      color: var(--fg);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    td { color: var(--fg-muted); }
    footer {
      margin-top: 64px;
      padding-top: 32px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--fg-muted);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    .theme-toggle-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg, rgba(255, 255, 255, 0.04));
      color: var(--fg-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .theme-toggle-btn:hover {
      color: var(--fg);
      border-color: var(--border-focus, rgba(255, 255, 255, 0.2));
      transform: scale(1.06);
    }
    .theme-toggle-btn:active {
      transform: scale(0.92);
    }
    .theme-toggle-btn svg {
      position: absolute;
      width: 16px;
      height: 16px;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
    }
    html[data-theme="dark"] .sun-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    html[data-theme="dark"] .moon-icon {
      opacity: 0;
      transform: rotate(-90deg) scale(0.35);
    }
    html[data-theme="light"] .sun-icon {
      opacity: 0;
      transform: rotate(90deg) scale(0.35);
    }
    html[data-theme="light"] .moon-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <span class="logo-mark">S</span>
      <span>Supdance</span>
    </a>
    <div class="nav-actions">
      <a href="/privacy" class="nav-link">Privacy</a>
      <a href="/aup" class="nav-link">AUP</a>
      <a href="/legal" class="nav-link">Legal Hub</a>
      <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="Toggle dark/light theme" title="切换明暗主题">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </header>
  <main>
    <h1>Terms of Service</h1>
    <div class="meta">EFFECTIVE: NOVEMBER 04, 2026 · VERSION 1.0 · WAFFO PANCAKE MOR</div>
    <div class="callout">
      <strong>Notice:</strong> Please read these terms carefully before utilizing Supdance AI Canvas. By using this service, you agree to be legally bound by these terms and our Privacy Policy.
    </div>
    <h2>1. Acceptance of Terms</h2>
    <p>Welcome to Supdance. By registering an account, purchasing computing credits, or utilizing our multi-modal generation tools, you acknowledge that you are at least 18 years of age and agree to these Terms of Service.</p>
    <h2>2. Digital Services & Instant Delivery</h2>
    <p>Supdance delivers digital SaaS creative software for screenwriting, image generation, video synthesis, and audio production. All credit top-up packages are purely digital intangibles delivered instantly upon successful payment authorization, with no physical shipping or tangible goods involved.</p>
    <h2>3. Pricing & Credits (V2 One-Time Credits)</h2>
    <p>Our platform operates strictly on a pre-paid, one-time credits model. We do not operate recurring subscriptions or unexpected recurring billing. All top-up transactions are initiated deliberately by you.</p>
    <h2>4. 7-Day Unused Refund Policy</h2>
    <p>You may request a 100% full refund on any credit top-up pack within 7 calendar days of purchase, provided zero credits from that package have been consumed. In the event of system errors where generation fails, credits are automatically reversed and credited back to your balance immediately.</p>
    <h2>5. AI Asset Ownership</h2>
    <p>Subject to compliance with these Terms and our Acceptable Use Policy, you retain all ownership, rights, and title in the creative assets generated via your purchased credits, and may utilize them for commercial purposes.</p>
    <footer>
      <div>&copy; 2026 Supdance. All rights reserved.</div>
      <div>support@supdance.com</div>
    </footer>
  </main>
  <script>
    (function() {
      var btn = document.getElementById('theme-toggle');
      function getPreferredTheme() {
        var saved = localStorage.getItem('supdance_html_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem('supdance_html_theme', theme); } catch (e) {}
      }
      applyTheme(getPreferredTheme());

      if (btn) {
        btn.addEventListener('click', function(e) {
          var current = document.documentElement.getAttribute('data-theme') || 'dark';
          var next = current === 'dark' ? 'light' : 'dark';

          if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            var rect = btn.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var maxRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            );

            var transition = document.startViewTransition(function() {
              applyTheme(next);
            });
            transition.ready.then(function() {
              document.documentElement.animate(
                {
                  clipPath: [
                    'circle(0px at ' + x + 'px ' + y + 'px)',
                    'circle(' + maxRadius + 'px at ' + x + 'px ' + y + 'px)'
                  ]
                },
                {
                  duration: 400,
                  easing: 'ease-in-out',
                  fill: 'forwards',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            }).catch(function() {});
          } else {
            applyTheme(next);
          }
        });
      }
    })();
  </script>
</body>
</html>`

const defaultLinearAupHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Acceptable Use Policy (AUP) · 可接受使用政策</title>
  <style>
    :root, html[data-theme="dark"] {
      --bg: #000000;
      --fg: #ffffff;
      --fg-muted: #8a8f98;
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(255, 255, 255, 0.2);
      --header-bg: rgba(0, 0, 0, 0.85);
      --card-bg: rgba(255, 255, 255, 0.03);
      --accent: #5e6ad2;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    html[data-theme="light"] {
      --bg: #ffffff;
      --fg: #111111;
      --fg-muted: #666666;
      --border: rgba(0, 0, 0, 0.08);
      --border-focus: rgba(0, 0, 0, 0.2);
      --header-bg: rgba(255, 255, 255, 0.85);
      --card-bg: rgba(0, 0, 0, 0.02);
      --accent: #5e6ad2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.8;
      letter-spacing: -0.011em;
      -webkit-font-smoothing: antialiased;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(20px, 4vw, 48px);
      height: 64px;
      background: var(--header-bg);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.02em;
      color: var(--fg);
      text-decoration: none;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--fg);
      color: var(--bg);
      font-size: 12px;
      font-weight: 700;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-link {
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s ease;
    }
    .nav-link:hover { color: var(--fg); }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: clamp(32px, 6vw, 72px) 24px clamp(64px, 8vw, 120px);
    }
    h1 {
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 600;
      letter-spacing: -0.035em;
      line-height: 1.1;
      margin-bottom: 12px;
    }
    .meta {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-top: 48px;
      margin-bottom: 16px;
      color: var(--fg);
    }
    p { color: var(--fg-muted); margin-bottom: 20px; }
    ul { margin: 16px 0 24px 20px; color: var(--fg-muted); }
    li { margin-bottom: 8px; }
    .callout {
      margin: 32px 0;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      color: var(--fg);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 13px;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      font-family: var(--font-mono);
      font-weight: 500;
      color: var(--fg);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    td { color: var(--fg-muted); }
    footer {
      margin-top: 64px;
      padding-top: 32px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--fg-muted);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    .theme-toggle-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg, rgba(255, 255, 255, 0.04));
      color: var(--fg-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .theme-toggle-btn:hover {
      color: var(--fg);
      border-color: var(--border-focus, rgba(255, 255, 255, 0.2));
      transform: scale(1.06);
    }
    .theme-toggle-btn:active {
      transform: scale(0.92);
    }
    .theme-toggle-btn svg {
      position: absolute;
      width: 16px;
      height: 16px;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
    }
    html[data-theme="dark"] .sun-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    html[data-theme="dark"] .moon-icon {
      opacity: 0;
      transform: rotate(-90deg) scale(0.35);
    }
    html[data-theme="light"] .sun-icon {
      opacity: 0;
      transform: rotate(90deg) scale(0.35);
    }
    html[data-theme="light"] .moon-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <span class="logo-mark">S</span>
      <span>Supdance</span>
    </a>
    <div class="nav-actions">
      <a href="/terms" class="nav-link">Terms</a>
      <a href="/privacy" class="nav-link">Privacy</a>
      <a href="/legal" class="nav-link">Legal Hub</a>
      <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="Toggle dark/light theme" title="切换明暗主题">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </header>
  <main>
    <h1>Acceptable Use Policy (AUP)</h1>
    <div class="meta">EFFECTIVE: NOVEMBER 04, 2026 · VERSION 1.0</div>
    <div class="callout">
      <strong>Zero Tolerance Notice:</strong> We enforce strict automated safeguards and human compliance reviews to prevent illegal, harmful, or non-consensual generations.
    </div>
    <h2 id="content-standards">1. Prohibited Content Standards</h2>
    <p>You may not generate, process, or disseminate any content involving:</p>
    <ul>
      <li><strong>CSAM:</strong> Child Sexual Abuse Material or child exploitation (Zero tolerance, immediate law enforcement referral).</li>
      <li><strong>NSFW & Adult Content:</strong> Sexually explicit imagery, pornography, or non-consensual sexual depictions.</li>
      <li><strong>Extreme Violence:</strong> Depictions of gore, mutilation, suicide promotion, or bodily harm.</li>
      <li><strong>Deepfakes & Impersonation:</strong> Deceptive synthetic representations of real people without verified explicit consent.</li>
      <li><strong>IP Infringement:</strong> Misappropriation of third-party registered trademarks or copyrighted characters.</li>
    </ul>
    <h2 id="moderation">2. Multi-Layer Moderation Pipeline</h2>
    <p>We deploy automated pre-flight filtering classifiers alongside human compliance auditing. Requests detected as violating policy will be blocked immediately without debiting credits.</p>
    <h2 id="reporting">3. Reporting & Timelines</h2>
    <p>Reports sent to safety@supdance.com are processed under strict service level objectives:</p>
    <table>
      <thead>
        <tr><th>Severity</th><th>Initial Response</th><th>Resolution Target</th></tr>
      </thead>
      <tbody>
        <tr><td>Level 1 (Severe / CSAM)</td><td>Within 2 Hours</td><td>Within 24 Hours</td></tr>
        <tr><td>Level 2 (High / Impersonation)</td><td>Within 24 Hours</td><td>Within 3 Business Days</td></tr>
        <tr><td>Level 3 (General / IP)</td><td>Within 48 Hours</td><td>Within 7 Business Days</td></tr>
      </tbody>
    </table>
    <h2 id="enforcement-actions">4. Enforcement Actions</h2>
    <p>Violations result in progressive penalties: formal content warnings, asset removal from cloud storage, temporary generation restriction (1–14 days), permanent account termination, and statutory referral to law enforcement.</p>
    <footer>
      <div>&copy; 2026 Supdance. All rights reserved.</div>
      <div>safety@supdance.com</div>
    </footer>
  </main>
  <script>
    (function() {
      var btn = document.getElementById('theme-toggle');
      function getPreferredTheme() {
        var saved = localStorage.getItem('supdance_html_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem('supdance_html_theme', theme); } catch (e) {}
      }
      applyTheme(getPreferredTheme());

      if (btn) {
        btn.addEventListener('click', function(e) {
          var current = document.documentElement.getAttribute('data-theme') || 'dark';
          var next = current === 'dark' ? 'light' : 'dark';

          if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            var rect = btn.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var maxRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            );

            var transition = document.startViewTransition(function() {
              applyTheme(next);
            });
            transition.ready.then(function() {
              document.documentElement.animate(
                {
                  clipPath: [
                    'circle(0px at ' + x + 'px ' + y + 'px)',
                    'circle(' + maxRadius + 'px at ' + x + 'px ' + y + 'px)'
                  ]
                },
                {
                  duration: 400,
                  easing: 'ease-in-out',
                  fill: 'forwards',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            }).catch(function() {});
          } else {
            applyTheme(next);
          }
        });
      }
    })();
  </script>
</body>
</html>`

const defaultVercelPrivacyHtml = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Privacy Policy · 隐私政策</title>
  <style>
    :root, html[data-theme="dark"] {
      --bg: #000000;
      --fg: #ededed;
      --fg-muted: #888888;
      --border: #222222;
      --sidebar-bg: #000000;
      --card-bg: #111111;
      --header-bg: rgba(0, 0, 0, 0.85);
      --accent: #0070f3;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      --font-mono: ui-monospace, Menlo, Consolas, monospace;
    }
    html[data-theme="light"] {
      --bg: #ffffff;
      --fg: #171717;
      --fg-muted: #666666;
      --border: #eaeaea;
      --sidebar-bg: #fafafa;
      --card-bg: #f5f5f5;
      --header-bg: rgba(255, 255, 255, 0.85);
      --accent: #0070f3;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.7;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 2px;
      background: var(--accent);
      z-index: 100;
      width: 100%;
      transform-origin: 0 50%;
      transform: scaleX(0);
      transition: transform 0.1s ease-out;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 24px;
      background: var(--header-bg);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--fg);
      text-decoration: none;
      font-size: 14px;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-link {
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 13px;
    }
    .nav-link:hover { color: var(--fg); }
    .layout {
      display: flex;
      max-width: 1080px;
      margin: 0 auto;
      padding: 32px 24px;
      gap: 48px;
    }
    aside {
      width: 220px;
      flex-shrink: 0;
      position: sticky;
      top: 88px;
      height: fit-content;
    }
    aside nav {
      display: flex;
      flex-col: column;
      gap: 6px;
    }
    aside a {
      display: block;
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 13px;
      padding: 6px 10px;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    aside a:hover {
      color: var(--fg);
      background: var(--card-bg);
    }
    article {
      flex: 1;
      min-width: 0;
      max-width: 720px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 8px;
    }
    .meta {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--fg-muted);
      margin-bottom: 32px;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 36px;
      margin-bottom: 12px;
      letter-spacing: -0.01em;
    }
    p { color: var(--fg-muted); margin-bottom: 16px; }
    ul { margin: 12px 0 20px 20px; color: var(--fg-muted); }
    li { margin-bottom: 6px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: var(--card-bg);
      font-weight: 600;
      font-size: 12px;
    }
    td { color: var(--fg-muted); }
    @media (max-width: 768px) {
      aside { display: none; }
      .layout { padding: 24px 16px; }
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    .theme-toggle-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg, rgba(255, 255, 255, 0.04));
      color: var(--fg-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .theme-toggle-btn:hover {
      color: var(--fg);
      border-color: var(--border-focus, rgba(255, 255, 255, 0.2));
      transform: scale(1.06);
    }
    .theme-toggle-btn:active {
      transform: scale(0.92);
    }
    .theme-toggle-btn svg {
      position: absolute;
      width: 16px;
      height: 16px;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
    }
    html[data-theme="dark"] .sun-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    html[data-theme="dark"] .moon-icon {
      opacity: 0;
      transform: rotate(-90deg) scale(0.35);
    }
    html[data-theme="light"] .sun-icon {
      opacity: 0;
      transform: rotate(90deg) scale(0.35);
    }
    html[data-theme="light"] .moon-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

  </style>
</head>
<body>
  <div class="progress-bar" id="pbar"></div>
  <header>
    <a href="/" class="brand">
      <svg width="20" height="20" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
      <span>Supdance Docs</span>
    </a>
    <div class="nav-links">
      <a href="/terms" class="nav-link">Terms</a>
      <a href="/aup" class="nav-link">AUP</a>
      <a href="/legal" class="nav-link">Legal Hub</a>
      <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="Toggle dark/light theme" title="切换明暗主题">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </header>
  <div class="layout">
    <aside>
      <nav>
        <a href="#controller">1. Data Controller</a>
        <a href="#collection">2. Data Collected</a>
        <a href="#bases">3. Legal Bases (GDPR)</a>
        <a href="#sharing">4. Third-Party Sharing</a>
        <a href="#security">5. Data Security</a>
        <a href="#rights">6. Your Rights</a>
      </nav>
    </aside>
    <article>
      <h1>Privacy Policy</h1>
      <div class="meta">UPDATED: NOVEMBER 04, 2026 · GDPR & CCPA COMPLIANT</div>
      <h2 id="controller">1. Data Controller Information</h2>
      <p>The data controller responsible for your personal data is Zhang Donghe (operating as "Supdance", support@supdance.com).</p>
      <h2 id="collection">2. Personal Data We Collect</h2>
      <p>We adhere to strict data minimization. We only collect:</p>
      <ul>
        <li><strong>Account Info:</strong> Email address and salted password hashes.</li>
        <li><strong>Payment Data:</strong> Handled entirely by PCI-DSS Level 1 certified processor Waffo Pancake. We never store complete card numbers or CVV codes.</li>
        <li><strong>Workspace Assets:</strong> Text prompts, reference photos, and canvas configurations. We pledge never to sell personal data under CCPA/CPRA.</li>
      </ul>
      <h2 id="bases">3. Purposes and Legal Bases (GDPR)</h2>
      <table>
        <thead>
          <tr><th>Purpose</th><th>Data Category</th><th>Legal Basis</th></tr>
        </thead>
        <tbody>
          <tr><td>Canvas Rendering</td><td>Account, Prompts</td><td>Contractual Necessity (Art. 6(1)(b))</td></tr>
          <tr><td>Billing & Invoicing</td><td>Order IDs, Records</td><td>Legal Compliance</td></tr>
          <tr><td>Platform Security</td><td>IP Address, Logs</td><td>Legitimate Interests</td></tr>
        </tbody>
      </table>
      <h2 id="sharing">4. Third-Party Sharing</h2>
      <p>We share data exclusively with trusted cloud hosts, certified payment processor Waffo Pancake, and enterprise model inference providers. Private data is never used for unauthorized public model training.</p>
      <h2 id="security">5. Security & Incident Notice</h2>
      <p>We utilize end-to-end TLS encryption and least-privilege security. In the event of a breach, impacted users and authorities will be alerted within 72 hours.</p>
      <h2 id="rights">6. Privacy Rights (GDPR & CCPA)</h2>
      <p>You have the right to access, rectify, port, or erase your account data at any time. Email support@supdance.com for requests.</p>
    </article>
  </div>
  <script>
    (function() {
      var btn = document.getElementById('theme-toggle');
      function getPreferredTheme() {
        var saved = localStorage.getItem('supdance_html_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem('supdance_html_theme', theme); } catch (e) {}
      }
      applyTheme(getPreferredTheme());

      if (btn) {
        btn.addEventListener('click', function(e) {
          var current = document.documentElement.getAttribute('data-theme') || 'dark';
          var next = current === 'dark' ? 'light' : 'dark';

          if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            var rect = btn.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var maxRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            );

            var transition = document.startViewTransition(function() {
              applyTheme(next);
            });
            transition.ready.then(function() {
              document.documentElement.animate(
                {
                  clipPath: [
                    'circle(0px at ' + x + 'px ' + y + 'px)',
                    'circle(' + maxRadius + 'px at ' + x + 'px ' + y + 'px)'
                  ]
                },
                {
                  duration: 400,
                  easing: 'ease-in-out',
                  fill: 'forwards',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            }).catch(function() {});
          } else {
            applyTheme(next);
          }
        });
      }
    })();
  </script>
  <script>
    window.addEventListener('scroll', function() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var bar = document.getElementById('pbar');
      if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0) + ')';
    });
  </script>
</body>
</html>`

const defaultAnthropicLegalHubHtml = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Legal & Compliance Center · 法务与合规中心</title>
  <style>
    :root, html[data-theme="dark"] {
      --bg: #141413;
      --fg: #fbfbf9;
      --fg-muted: #a09f9c;
      --border: rgba(255, 255, 255, 0.08);
      --card-bg: #1d1c1a;
      --card-hover: #262523;
      --header-bg: rgba(20, 20, 19, 0.88);
      --accent: #d97706;
      --font-serif: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", serif;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
    }
    html[data-theme="light"] {
      --bg: #fbfbf9;
      --fg: #141413;
      --fg-muted: #605f5b;
      --border: rgba(0, 0, 0, 0.08);
      --card-bg: #ffffff;
      --card-hover: #f3f3f0;
      --header-bg: rgba(251, 251, 249, 0.88);
      --accent: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.6;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 clamp(20px, 4vw, 48px);
      background: var(--header-bg);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      font-family: var(--font-serif);
      font-size: 18px;
      font-weight: 600;
      color: var(--fg);
      text-decoration: none;
      letter-spacing: -0.01em;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .back-link {
      font-size: 13px;
      color: var(--fg-muted);
      text-decoration: none;
    }
    .back-link:hover { color: var(--fg); }
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 64px 24px 96px;
    }
    .hero {
      text-align: center;
      margin-bottom: 56px;
    }
    .hero h1 {
      font-family: var(--font-serif);
      font-size: clamp(32px, 5vw, 44px);
      font-weight: 500;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    .hero p {
      color: var(--fg-muted);
      font-size: 16px;
      max-width: 580px;
      margin: 0 auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .card:hover {
      border-color: rgba(217, 119, 6, 0.4);
      background: var(--card-hover);
      transform: translateY(-2px);
    }
    .card-tag {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 12px;
      font-weight: 600;
    }
    .card h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      letter-spacing: -0.01em;
    }
    .card p {
      font-size: 13px;
      color: var(--fg-muted);
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .card-footer {
      font-size: 13px;
      color: var(--accent);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    .theme-toggle-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg, rgba(255, 255, 255, 0.04));
      color: var(--fg-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .theme-toggle-btn:hover {
      color: var(--fg);
      border-color: var(--border-focus, rgba(255, 255, 255, 0.2));
      transform: scale(1.06);
    }
    .theme-toggle-btn:active {
      transform: scale(0.92);
    }
    .theme-toggle-btn svg {
      position: absolute;
      width: 16px;
      height: 16px;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
    }
    html[data-theme="dark"] .sun-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    html[data-theme="dark"] .moon-icon {
      opacity: 0;
      transform: rotate(-90deg) scale(0.35);
    }
    html[data-theme="light"] .sun-icon {
      opacity: 0;
      transform: rotate(90deg) scale(0.35);
    }
    html[data-theme="light"] .moon-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

  </style>
</head>
<body>
  <header>
    <a href="/" class="brand">Supdance Legal</a>
    <div class="header-right">
      <a href="/" class="back-link">Back to Workspace &rarr;</a>
      <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="Toggle dark/light theme" title="切换明暗主题">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </header>
  <main>
    <div class="hero">
      <h1>Legal & Compliance Hub</h1>
      <p>Everything you need to know about our legal terms, privacy protections, and responsible AI policies.</p>
    </div>
    <div class="grid">
      <a href="/terms" class="card">
        <div>
          <div class="card-tag">Terms of Service</div>
          <h3>Terms of Service</h3>
          <p>Covers account registration, digital instant delivery of credits, PCI-DSS payment compliance, and AI asset ownership.</p>
        </div>
        <div class="card-footer">Read terms &rarr;</div>
      </a>
      <a href="/privacy" class="card">
        <div>
          <div class="card-tag">Privacy Policy</div>
          <h3>Privacy Policy</h3>
          <p>Explains our data minimization pledge, zero sale of personal information, GDPR/CCPA rights, and security auditing.</p>
        </div>
        <div class="card-footer">Read policy &rarr;</div>
      </a>
      <a href="/aup" class="card">
        <div>
          <div class="card-tag">Content Standards</div>
          <h3>Acceptable Use Policy (AUP)</h3>
          <p>Defines content restrictions (anti-CSAM, anti-deepfake, non-NSFW), moderation mechanisms, and reporting desk timelines.</p>
        </div>
        <div class="card-footer">Read standards &rarr;</div>
      </a>
      <a href="/refund" class="card">
        <div>
          <div class="card-tag">Refund & Billing</div>
          <h3>Refund & Dispute Policy</h3>
          <p>Clear 7-day refund guarantee for unused credits, automatic credit reversal for failed tasks, and chargeback prevention.</p>
        </div>
        <div class="card-footer">Read policy &rarr;</div>
      </a>
    </div>
  </main>
  <script>
    (function() {
      var btn = document.getElementById('theme-toggle');
      function getPreferredTheme() {
        var saved = localStorage.getItem('supdance_html_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem('supdance_html_theme', theme); } catch (e) {}
      }
      applyTheme(getPreferredTheme());

      if (btn) {
        btn.addEventListener('click', function(e) {
          var current = document.documentElement.getAttribute('data-theme') || 'dark';
          var next = current === 'dark' ? 'light' : 'dark';

          if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            var rect = btn.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var maxRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            );

            var transition = document.startViewTransition(function() {
              applyTheme(next);
            });
            transition.ready.then(function() {
              document.documentElement.animate(
                {
                  clipPath: [
                    'circle(0px at ' + x + 'px ' + y + 'px)',
                    'circle(' + maxRadius + 'px at ' + x + 'px ' + y + 'px)'
                  ]
                },
                {
                  duration: 400,
                  easing: 'ease-in-out',
                  fill: 'forwards',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            }).catch(function() {});
          } else {
            applyTheme(next);
          }
        });
      }
    })();
  </script>
</body>
</html>`

const defaultSupabaseRefundHtml = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Refund & Billing Policy · 退款与账单争议政策</title>
  <style>
    :root, html[data-theme="dark"] {
      --bg: #121212;
      --fg: #ededed;
      --fg-muted: #888888;
      --border: #2a2a2a;
      --border-focus: #444444;
      --card-bg: #1c1c1c;
      --header-bg: rgba(18, 18, 18, 0.85);
      --accent: #3ecf8e;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    html[data-theme="light"] {
      --bg: #ffffff;
      --fg: #171717;
      --fg-muted: #707070;
      --border: #e6e6e6;
      --border-focus: #cccccc;
      --card-bg: #f9f9f9;
      --header-bg: rgba(255, 255, 255, 0.85);
      --accent: #24b47e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.75;
      padding: 0 0 64px 0;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 clamp(20px, 4vw, 48px);
      background: var(--header-bg);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--fg);
      text-decoration: none;
      font-size: 14px;
    }
    .brand-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-link {
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 13px;
    }
    .nav-link:hover { color: var(--fg); }
    main {
      max-width: 680px;
      margin: 48px auto 0;
      padding: 0 24px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .lead {
      color: var(--fg-muted);
      font-size: 16px;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 36px;
      margin-bottom: 12px;
    }
    p { color: var(--fg-muted); margin-bottom: 16px; }
    ul { margin: 12px 0 20px 20px; color: var(--fg-muted); }
    li { margin-bottom: 6px; }
    .box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    .theme-toggle-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg, rgba(255, 255, 255, 0.04));
      color: var(--fg-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .theme-toggle-btn:hover {
      color: var(--fg);
      border-color: var(--border-focus, rgba(255, 255, 255, 0.2));
      transform: scale(1.06);
    }
    .theme-toggle-btn:active {
      transform: scale(0.92);
    }
    .theme-toggle-btn svg {
      position: absolute;
      width: 16px;
      height: 16px;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
    }
    html[data-theme="dark"] .sun-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    html[data-theme="dark"] .moon-icon {
      opacity: 0;
      transform: rotate(-90deg) scale(0.35);
    }
    html[data-theme="light"] .sun-icon {
      opacity: 0;
      transform: rotate(90deg) scale(0.35);
    }
    html[data-theme="light"] .moon-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

  </style>
</head>
<body>
  <header>
    <a href="/" class="brand">
      <span class="brand-dot"></span>
      <span>Supdance Billing</span>
    </a>
    <div class="nav-links">
      <a href="/terms" class="nav-link">Terms</a>
      <a href="/privacy" class="nav-link">Privacy</a>
      <a href="/legal" class="nav-link">Legal Hub</a>
      <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="Toggle dark/light theme" title="切换明暗主题">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>
  </header>
  <main>
    <h1>Refund & Dispute Policy</h1>
    <p class="lead">Transparent rules governing digital credit refunds, billing inquiries, and automatic task failure credits.</p>
    <div class="box">
      <strong>Core Commitment:</strong> All purchases are one-time credit top-ups processed via PCI-DSS certified MOR Waffo Pancake. No subscription renewals or hidden recurring charges exist.
    </div>
    <h2>1. 7-Day Full Refund for Unused Credits</h2>
    <p>You may request a 100% full refund on any purchased credit top-up within 7 calendar days of purchase, provided no credits from that order have been consumed.</p>
    <h2>2. Immediate Task Failure Reversals</h2>
    <p>If an AI generation job fails to output valid results due to upstream model timeouts or system disruptions, the credits frozen for that task are automatically refunded to your balance.</p>
    <h2>3. Billing Questions & Support</h2>
    <p>Your statement will show "Supdance" or "PANCAKE*SUPDANCE". Contact support@supdance.com for any billing inquiries.</p>
  </main>
  <script>
    (function() {
      var btn = document.getElementById('theme-toggle');
      function getPreferredTheme() {
        var saved = localStorage.getItem('supdance_html_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem('supdance_html_theme', theme); } catch (e) {}
      }
      applyTheme(getPreferredTheme());

      if (btn) {
        btn.addEventListener('click', function(e) {
          var current = document.documentElement.getAttribute('data-theme') || 'dark';
          var next = current === 'dark' ? 'light' : 'dark';

          if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            var rect = btn.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var maxRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            );

            var transition = document.startViewTransition(function() {
              applyTheme(next);
            });
            transition.ready.then(function() {
              document.documentElement.animate(
                {
                  clipPath: [
                    'circle(0px at ' + x + 'px ' + y + 'px)',
                    'circle(' + maxRadius + 'px at ' + x + 'px ' + y + 'px)'
                  ]
                },
                {
                  duration: 400,
                  easing: 'ease-in-out',
                  fill: 'forwards',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            }).catch(function() {});
          } else {
            applyTheme(next);
          }
        });
      }
    })();
  </script>
</body>
</html>`
