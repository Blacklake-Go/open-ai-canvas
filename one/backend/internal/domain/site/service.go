package site

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BrandConfig struct {
	BrandName     string `json:"brandName"`
	SiteTitle     string `json:"siteTitle"`
	TitleTemplate string `json:"titleTemplate"`
	BrandSlogan   string `json:"brandSlogan"`
	LogoType      string `json:"logoType"`
	LogoUrl       string `json:"logoUrl"`
	LogoIcon      string `json:"logoIcon"`
	LogoBgColor   string `json:"logoBgColor"`
	LogoTextColor string `json:"logoTextColor"`
	LogoHref      string `json:"logoHref"`
	LogoTarget    string `json:"logoTarget"`
	ShowBrandName bool   `json:"showBrandName"`
	FaviconUrl    string `json:"faviconUrl"`
}

type NavItem struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	LabelEn   string `json:"labelEn"`
	Href      string `json:"href"`
	Icon      string `json:"icon"`
	IconColor string `json:"iconColor"`
	Style     string `json:"style"`
	Badge     string `json:"badge"`
	Enabled   bool   `json:"enabled"`
	Target    string `json:"target"`
	Order     int    `json:"order"`
}

type BrandingPayload struct {
	Brand      BrandConfig `json:"brand"`
	Navigation []NavItem   `json:"navigation"`
}

type BannerConfig struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Enabled       bool   `json:"enabled"`
	HighlightText string `json:"highlightText"`
	Message       string `json:"message"`
	CtaText       string `json:"ctaText"`
	LinkUrl       string `json:"linkUrl"`
	LinkTarget    string `json:"linkTarget"`
	Theme         string `json:"theme"`
	AmbientGlow   bool   `json:"ambientGlow"`
	GlowStyle     string `json:"glowStyle"`
	DynamicEffect string `json:"dynamicEffect"`
	Dismissible   bool   `json:"dismissible"`
	AutoHideDays  int    `json:"autoHideDays"`
	BadgeText     string `json:"badgeText"`
	ShowPulseDot  bool   `json:"showPulseDot"`
	TargetScope   string `json:"targetScope"`
}

type MotionConfig struct {
	MotionLevel   string `json:"motionLevel"`
	AmbientGlow   bool   `json:"ambientGlow"`
	CardTiltHover bool   `json:"cardTiltHover"`
	BannerPulse   bool   `json:"bannerPulse"`
}

type ContentConfigPayload struct {
	Banner   BannerConfig    `json:"banner"`
	Motion   MotionConfig    `json:"motion"`
	Features map[string]bool `json:"features"`
}

type FAQItem struct {
	ID       string `json:"id"`
	Order    int    `json:"order"`
	Enabled  bool   `json:"enabled"`
	Category string `json:"category"`
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type SubscriptionFAQPayload struct {
	Notice        string    `json:"notice"`
	SupportEmail  string    `json:"supportEmail"`
	InvoiceNotice string    `json:"invoiceNotice"`
	Items         []FAQItem `json:"items"`
}

type I18nPayload struct {
	Locale   string         `json:"locale"`
	Messages map[string]any `json:"messages"`
	Catalog  map[string]any `json:"catalog"`
}

type Repository interface {
	GetSetting(ctx context.Context, key string) (json.RawMessage, error)
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetSetting(ctx context.Context, key string) (json.RawMessage, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	var raw json.RawMessage
	err := r.Pool.QueryRow(ctx, `SELECT value_json FROM ops_bill.system_settings WHERE key = $1 LIMIT 1`, key).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return raw, nil
}

type Service struct {
	Repo Repository
}

func DefaultBrandConfig() BrandConfig {
	return BrandConfig{
		BrandName:     "supdance",
		SiteTitle:     "SupDance — Free AI Image & Video Studio",
		TitleTemplate: "%s | SupDance AI Studio",
		BrandSlogan:   "AI 创意工作室",
		LogoType:      "image",
		LogoUrl:       "/uploads/branding/logo-1789960604256-8d69f211113d.png",
		LogoIcon:      "layers",
		LogoBgColor:   "#22d3ee",
		LogoTextColor: "#000000",
		LogoHref:      "/",
		LogoTarget:    "_self",
		ShowBrandName: false,
		FaviconUrl:    "/uploads/branding/icon-1790631358168-d0b66b0fc4e1.svg",
	}
}

func DefaultNavigationConfig() []NavItem {
	return []NavItem{
		{ID: "nav_community", Label: "即梦社区", LabelEn: "Community", Href: "/community", Icon: "flame", IconColor: "#fb923c", Style: "gradient", Badge: "HOT", Enabled: true, Target: "_self", Order: 1},
		{ID: "nav_creations", Label: "我的作品", LabelEn: "My Creations", Href: "/creations", Icon: "folder", IconColor: "#facc15", Style: "subtle", Enabled: true, Target: "_self", Order: 2},
		{ID: "nav_pricing", Label: "商用定价", LabelEn: "Pricing", Href: "/pricing", Icon: "zap", IconColor: "#e11d74", Style: "subtle", Badge: "PRO", Enabled: true, Target: "_self", Order: 3},
		{ID: "nav_call_api", Label: "开放平台", LabelEn: "API", Href: "/call-api", Icon: "workflow", IconColor: "#a855f7", Style: "subtle", Badge: "筹备中", Enabled: true, Target: "_self", Order: 4},
		{ID: "nav_about", Label: "关于本站", LabelEn: "About", Href: "/about", Icon: "sparkles", IconColor: "#38bdf8", Style: "subtle", Enabled: true, Target: "_self", Order: 999},
	}
}

func (s *Service) GetBranding(ctx context.Context) BrandingPayload {
	brand := DefaultBrandConfig()
	nav := DefaultNavigationConfig()
	if s.Repo != nil {
		if raw, err := s.Repo.GetSetting(ctx, "site_brand"); err == nil && len(raw) > 0 {
			_ = json.Unmarshal(raw, &brand)
		}
		if raw, err := s.Repo.GetSetting(ctx, "site_navigation"); err == nil && len(raw) > 0 {
			var parsed []NavItem
			if err := json.Unmarshal(raw, &parsed); err == nil && len(parsed) > 0 {
				nav = parsed
			}
		}
	}
	return BrandingPayload{Brand: brand, Navigation: nav}
}

func (s *Service) GetContentConfig(ctx context.Context) ContentConfigPayload {
	banner := BannerConfig{
		ID:            "banner-default",
		Title:         "Flova 风格沉浸式横幅",
		Enabled:       true,
		HighlightText: "上新特惠：",
		Message:       "年会员享 Flova Image 2.5、Seedance 2.5 最低4折，1K 低至 ¥0.058/张",
		CtaText:       "立即订阅",
		LinkUrl:       "/studio?account=open&tab=membership",
		LinkTarget:    "_self",
		Theme:         "indigo",
		AmbientGlow:   true,
		GlowStyle:     "aurora",
		DynamicEffect: "breathe",
		Dismissible:   true,
		AutoHideDays:  7,
		BadgeText:     "HOT",
		ShowPulseDot:  true,
		TargetScope:   "all",
	}
	motion := MotionConfig{
		MotionLevel:   "full",
		AmbientGlow:   true,
		CardTiltHover: true,
		BannerPulse:   true,
	}
	exploreApps := false
	if s.Repo != nil {
		if raw, err := s.Repo.GetSetting(ctx, "site_banner"); err == nil && len(raw) > 0 {
			_ = json.Unmarshal(raw, &banner)
		}
		if raw, err := s.Repo.GetSetting(ctx, "homepage_motion"); err == nil && len(raw) > 0 {
			_ = json.Unmarshal(raw, &motion)
		}
		if raw, err := s.Repo.GetSetting(ctx, "feature_explore_apps"); err == nil && len(raw) > 0 {
			var v struct {
				Enabled bool `json:"enabled"`
			}
			if err := json.Unmarshal(raw, &v); err == nil {
				exploreApps = v.Enabled
			} else {
				var b bool
				if err := json.Unmarshal(raw, &b); err == nil {
					exploreApps = b
				}
			}
		}
	}
	return ContentConfigPayload{
		Banner:   banner,
		Motion:   motion,
		Features: map[string]bool{"explore_apps_enabled": exploreApps},
	}
}

func (s *Service) GetSubscriptionFAQ(ctx context.Context) SubscriptionFAQPayload {
	out := SubscriptionFAQPayload{
		Notice:        "所有会员套餐均支持随时升级或取消，算力随周期自动充值发放，未生成成功系统自动秒级返还。",
		SupportEmail:  "support@Supdance.com",
		InvoiceNotice: "已支付订单可在个人中心“支付凭证”中预览并下载；企业开票请在个人中心提交开票信息。",
		Items: []FAQItem{
			{
				ID:       "faq-1",
				Order:    1,
				Enabled:  true,
				Category: "quota",
				Question: "什么是订阅制专属额度？与通用算力有何区别？",
				Answer:   "订阅额度是每月随会员周期发放的核心资产，享有最高抵扣优先级，当月有效；通用算力永久有效。",
			},
			{
				ID:       "faq-2",
				Order:    2,
				Enabled:  true,
				Category: "quota",
				Question: "生成失败会扣除我的额度吗？",
				Answer:   "绝对不会。系统采用两阶段安全预扣机制，失败时冻结额度自动返还。",
			},
		},
	}
	if s.Repo != nil {
		if raw, err := s.Repo.GetSetting(ctx, "subscription_faq_config"); err == nil && len(raw) > 0 {
			_ = json.Unmarshal(raw, &out)
		}
	}
	filtered := make([]FAQItem, 0, len(out.Items))
	for _, it := range out.Items {
		if it.Enabled {
			filtered = append(filtered, it)
		}
	}
	out.Items = filtered
	return out
}

var localeAliases = map[string]string{
	"en":    "en",
	"zh":    "zh-CN",
	"zh-cn": "zh-CN",
	"zh-tw": "zh-TW",
	"ja":    "ja-JP",
	"ja-jp": "ja-JP",
	"ko":    "ko-KR",
	"ko-kr": "ko-KR",
	"es":    "es",
	"es-es": "es",
	"es-la": "es",
	"es-mx": "es",
	"es-ar": "es",
}

func NormalizeLocale(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false
	}
	norm, ok := localeAliases[strings.ToLower(trimmed)]
	return norm, ok
}

func (s *Service) GetI18n(ctx context.Context, requestedLocale string) (*I18nPayload, bool) {
	norm, ok := NormalizeLocale(requestedLocale)
	if !ok {
		return nil, false
	}
	messages := map[string]any{"locale": norm}
	catalog := map[string]any{"common": messages}
	if s.Repo != nil {
		if raw, err := s.Repo.GetSetting(ctx, "i18n.published"); err == nil && len(raw) > 0 {
			var all map[string]map[string]any
			if err := json.Unmarshal(raw, &all); err == nil {
				if ov, exists := all[norm]; exists {
					for k, v := range ov {
						messages[k] = v
					}
				}
			}
		}
	}
	return &I18nPayload{
		Locale:   norm,
		Messages: messages,
		Catalog:  catalog,
	}, true
}

const DefaultCanonicalBase = "https://www.supdance.com"

type SitemapRoute struct {
	Path       string
	Priority   string
	ChangeFreq string
}

var DefaultIndexableRoutes = []SitemapRoute{
	{Path: "/", Priority: "1.0", ChangeFreq: "daily"},
	{Path: "/studio", Priority: "0.9", ChangeFreq: "daily"},
	{Path: "/models", Priority: "0.9", ChangeFreq: "daily"},
	{Path: "/community", Priority: "0.8", ChangeFreq: "daily"},
	{Path: "/pricing", Priority: "0.8", ChangeFreq: "weekly"},
	{Path: "/creations", Priority: "0.7", ChangeFreq: "daily"},
	{Path: "/about", Priority: "0.6", ChangeFreq: "monthly"},
	{Path: "/feedback", Priority: "0.5", ChangeFreq: "monthly"},
	{Path: "/coins", Priority: "0.6", ChangeFreq: "weekly"},
	{Path: "/benefits", Priority: "0.6", ChangeFreq: "weekly"},
	{Path: "/credits", Priority: "0.6", ChangeFreq: "weekly"},
	{Path: "/privacy", Priority: "0.3", ChangeFreq: "monthly"},
	{Path: "/terms", Priority: "0.3", ChangeFreq: "monthly"},
	{Path: "/refund", Priority: "0.3", ChangeFreq: "monthly"},
	{Path: "/content-policy", Priority: "0.3", ChangeFreq: "monthly"},
}

func (s *Service) GetCanonicalBase(ctx context.Context) string {
	base := DefaultCanonicalBase
	if s != nil && s.Repo != nil {
		if raw, err := s.Repo.GetSetting(ctx, "site_seo"); err == nil && len(raw) > 0 {
			var cfg struct {
				CanonicalBase string `json:"canonicalBase"`
			}
			if err := json.Unmarshal(raw, &cfg); err == nil && strings.TrimSpace(cfg.CanonicalBase) != "" {
				base = strings.TrimSpace(cfg.CanonicalBase)
			}
		}
	}
	return strings.TrimRight(base, "/")
}

func (s *Service) GenerateSitemapXML(ctx context.Context, lastmod string) string {
	if strings.TrimSpace(lastmod) == "" {
		lastmod = "2026-11-15"
	}
	return BuildSitemapXML(s.GetCanonicalBase(ctx), lastmod, DefaultIndexableRoutes)
}

func BuildSitemapXML(canonicalBase, lastmod string, routes []SitemapRoute) string {
	cleanBase := strings.TrimRight(strings.TrimSpace(canonicalBase), "/")
	if cleanBase == "" {
		cleanBase = DefaultCanonicalBase
	}
	if len(routes) == 0 {
		routes = DefaultIndexableRoutes
	}
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	for _, r := range routes {
		rawPath := strings.SplitN(strings.SplitN(r.Path, "?", 2)[0], "#", 2)[0]
		if rawPath == "" {
			continue
		}
		if !strings.HasPrefix(rawPath, "/") {
			rawPath = "/" + rawPath
		}
		if strings.HasPrefix(rawPath, "/admin") || strings.HasPrefix(rawPath, "/api") {
			continue
		}
		loc := cleanBase + "/"
		if rawPath != "/" {
			loc = cleanBase + strings.TrimRight(rawPath, "/")
		}
		prio := r.Priority
		if prio == "" {
			if rawPath == "/" {
				prio = "1.0"
			} else {
				prio = "0.8"
			}
		}
		cf := r.ChangeFreq
		if cf == "" {
			cf = "daily"
		}
		b.WriteString("  <url>\n")
		b.WriteString("    <loc>" + loc + "</loc>\n")
		b.WriteString("    <lastmod>" + lastmod + "</lastmod>\n")
		b.WriteString("    <changefreq>" + cf + "</changefreq>\n")
		b.WriteString("    <priority>" + prio + "</priority>\n")
		b.WriteString("  </url>\n")
	}
	b.WriteString("</urlset>")
	return b.String()
}
