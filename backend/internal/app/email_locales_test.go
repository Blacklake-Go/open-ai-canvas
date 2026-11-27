package app

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/emailcenter"
	"yingce/backend/internal/supdance/maillocale"
)

func TestEmailCenterLocaleVersionsAndRecipientPreference(t *testing.T) {
	s, db, actor := emailCenterFixture(t)
	if err := db.Create(actor).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.InitializeEmailCenter(actor); err != nil {
		t.Fatal(err)
	}
	if err := s.InitializeEmailCenter(actor); err != nil {
		t.Fatal(err)
	}
	var count int64
	db.Model(&model.SupDanceEmailTemplate{}).Count(&count)
	if count != 88 {
		t.Fatalf("expected 88 independent locale templates, got %d", count)
	}
	english, _, err := s.emailCenterDocument("registration", "en-US")
	if err != nil {
		t.Fatal(err)
	}
	japanese, jpID, err := s.emailCenterDocument("registration", "ja-JP")
	if err != nil {
		t.Fatal(err)
	}
	state, _ := s.repo.EmailTemplate("registration", "ja-JP")
	japanese.Subject = "JP · {{brand_name}}"
	if err := s.SaveEmailCenterDraft(actor, "registration", EmailCenterEditRequest{Locale: "ja-JP", Document: japanese, ExpectedRevision: state.Revision}); err != nil {
		t.Fatal(err)
	}
	state, _ = s.repo.EmailTemplate("registration", "ja-JP")
	if err := s.PublishEmailCenter(actor, "registration", EmailCenterEditRequest{Locale: "en-US", RevisionID: state.DraftID, ExpectedRevision: 1}); err == nil {
		t.Fatal("cross-locale publication accepted")
	}
	if err := s.PublishEmailCenter(actor, "registration", EmailCenterEditRequest{Locale: "ja-JP", RevisionID: state.DraftID, ExpectedRevision: state.Revision}); err != nil {
		t.Fatal(err)
	}
	unchanged, _, _ := s.emailCenterDocument("registration", "en-US")
	if unchanged.Subject != english.Subject {
		t.Fatal("Japanese edit changed English template")
	}
	state, _ = s.repo.EmailTemplate("registration", "ja-JP")
	if err := s.PublishEmailCenter(actor, "registration", EmailCenterEditRequest{Locale: "ja-JP", RevisionID: jpID, ExpectedRevision: state.Revision}); err != nil {
		t.Fatal(err)
	}
	contact := model.SupDanceEmailContact{Email: actor.Email, Marketing: false, Scope: "marketing", Suppression: "complaint"}
	if err := s.repo.SaveEmailContact(&contact); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetUserEmailLocale(actor, "fr-FR"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetUserEmailLocale(actor, "xx-YY"); err == nil {
		t.Fatal("invalid preference stored")
	}
	locale, err := s.authDomain().ResolveEmailLocale(auth.EmailDelivery{UserID: actor.ID, Locale: "de-DE"})
	if err != nil || locale != "fr-FR" {
		t.Fatal("recipient preference was not authoritative", err)
	}
	stored, _ := s.repo.EmailContact(actor.Email)
	if stored.Marketing || stored.Suppression != "complaint" || stored.PreferredLocale != "fr-FR" {
		t.Fatal("language write changed consent or suppression")
	}
	if _, err := s.SetUserEmailLocale(nil, "en-US"); err == nil {
		t.Fatal("anonymous preference write")
	}
	if err := s.CreateEmailCampaign(actor, EmailCampaignRequest{Name: "Missing translations", TemplateKey: "newsletter", Variables: map[string]string{"update_title": "Chinese-only title", "update_body": "Chinese-only body"}}); err == nil {
		t.Fatal("editorial text silently reused for every locale")
	}
	translations := map[string]map[string]string{}
	for _, locale := range maillocale.Supported() {
		translations[locale] = map[string]string{"update_title": maillocale.Text(locale, "preview_title"), "update_body": maillocale.Text(locale, "preview_body")}
	}
	if err := s.CreateEmailCampaign(actor, EmailCampaignRequest{Name: "Eight languages", TemplateKey: "newsletter", VariablesByLocale: translations}); err != nil {
		t.Fatal(err)
	}
	campaigns, _ := s.repo.EmailCampaigns()
	var versions map[string]string
	if json.Unmarshal([]byte(campaigns[0].RevisionsJSON), &versions) != nil || len(versions) != 8 {
		t.Fatal("campaign did not pin all locale versions")
	}
}

func TestEmailCenterCustomBrandLogoFollowsAppearanceAndKeepsOldSnapshot(t *testing.T) {
	s, db, actor := emailCenterFixture(t)
	if err := db.AutoMigrate(&model.Resource{}); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(s.dataDir, "resources", "logo"), 0700); err != nil {
		t.Fatal(err)
	}
	var brands []emailcenter.Brand
	for index, fill := range []color.NRGBA{{R: 13, G: 27, B: 41, A: 255}, {R: 81, G: 97, B: 113, A: 255}} {
		graphic := image.NewNRGBA(image.Rect(0, 0, 96, 48))
		graphic.SetNRGBA(20, 20, fill)
		var data bytes.Buffer
		if err := png.Encode(&data, graphic); err != nil {
			t.Fatal(err)
		}
		id := []string{"site-logo-a", "site-logo-b"}[index]
		key := "logo/" + id + ".png"
		if err := os.WriteFile(filepath.Join(s.dataDir, "resources", key), data.Bytes(), 0600); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&model.Resource{ID: id, UserID: actor.ID, Kind: "image", Status: model.ResourceStatusReady, Provider: "local", ObjectKey: key, MimeType: "image/png", Width: 96, Height: 48, Size: int64(data.Len())}).Error; err != nil {
			t.Fatal(err)
		}
		setting := defaultAppearanceSetting()
		setting.BrandName = "Custom Studio"
		setting.LogoResourceID = id
		if _, err := s.UpdateAppearance(actor, setting); err != nil {
			t.Fatal(err)
		}
		brand, err := s.emailCenterBrand()
		if err != nil {
			t.Fatal(err)
		}
		hash := sha256.Sum256(data.Bytes())
		want := hex.EncodeToString(hash[:])
		if !strings.HasSuffix(brand.LogoURL, want) {
			t.Fatal("mail logo is not the current site graphic")
		}
		asset, err := s.EmailCenterBrandAsset(want)
		if err != nil || !bytes.Equal(asset.Data, data.Bytes()) {
			t.Fatal("anonymous immutable logo changed bytes")
		}
		brands = append(brands, brand)
	}
	if brands[0].LogoURL == brands[1].LogoURL || brands[0].Version == brands[1].Version {
		t.Fatal("site logo update did not change mail brand")
	}
	old := brands[0].LogoURL[strings.LastIndex(brands[0].LogoURL, "/")+1:]
	if _, err := s.EmailCenterBrandAsset(old); err != nil {
		t.Fatal("old mail image was destroyed")
	}
}

func TestEmailCenterSupDanceUsesFooterArtwork(t *testing.T) {
	s, _, actor := emailCenterFixture(t)
	setting := defaultAppearanceSetting()
	setting.BrandName = "supdance"
	if _, err := s.UpdateAppearance(actor, setting); err != nil {
		t.Fatal(err)
	}
	_, source, _, _ := runtime.Caller(0)
	artwork, err := os.ReadFile(filepath.Join(filepath.Dir(source), "../../../web/public/supdance-footer-logo.png"))
	if err != nil {
		t.Fatal(err)
	}
	brand, err := s.AdminEmailBrand(actor)
	if err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(artwork)
	id := hex.EncodeToString(hash[:])
	asset, err := s.EmailCenterBrandAsset(id)
	if err != nil {
		t.Fatal(err)
	}
	if brand.LogoURL != "https://mail.example.com/api/public/email-center/brand/"+id || asset.ContentType != "image/png" || !bytes.Equal(asset.Data, artwork) {
		t.Fatal("SupDance mail brand did not use the site footer PNG")
	}
	event, ok := emailcenter.LocalizedEvent("test", emailcenter.Locale)
	if !ok {
		t.Fatal("SMTP test template is missing")
	}
	preview, err := s.PreviewEmailCenter(actor, event.Key, EmailCenterEditRequest{Locale: event.Locale, Document: emailcenter.DefaultDocument(event)})
	if err != nil || !strings.Contains(preview.HTML, `src="`+brand.LogoURL+`"`) {
		t.Fatalf("SMTP test template did not render the footer logo: %v", err)
	}
}

func TestEmailCenterWebPLogoRetainsGraphicAndDimensions(t *testing.T) {
	_, source, _, _ := runtime.Caller(0)
	data, err := os.ReadFile(filepath.Join(filepath.Dir(source), "../../../web/public/themes/yunhe-xianguan/assets-empty-1.webp"))
	if err != nil {
		t.Fatal(err)
	}
	original, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	normalized, kind, err := normalizeMailLogo(data)
	if err != nil {
		t.Fatal(err)
	}
	decoded, _, err := image.Decode(bytes.NewReader(normalized))
	if err != nil {
		t.Fatal(err)
	}
	if kind != "image/png" || decoded.Bounds() != original.Bounds() {
		t.Fatal("WebP conversion changed dimensions")
	}
	for _, point := range []image.Point{{X: 0, Y: 0}, {X: original.Bounds().Dx() / 2, Y: original.Bounds().Dy() / 2}} {
		if color.NRGBAModel.Convert(decoded.At(point.X, point.Y)) != color.NRGBAModel.Convert(original.At(point.X, point.Y)) {
			t.Fatal("conversion changed logo pixels")
		}
	}
}
