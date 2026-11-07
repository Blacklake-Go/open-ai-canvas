package app

import (
	"bytes"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/socialauth"
)

func TestSocialBrandIconLifecycle(t *testing.T) {
	svc, _, _, admin := newAppearanceTestService(t)
	image := append([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}, bytes.Repeat([]byte{0}, 32)...)
	user := &model.User{ID: "ordinary", Role: model.UserRoleUser, Status: model.UserStatusActive}
	if _, err := svc.UploadSocialBrandIcon(user, multipartFileHeader(t, "icon.png", "image/png", image)); err == nil {
		t.Fatal("non-admin upload accepted")
	}
	if _, err := svc.UploadSocialBrandIcon(admin, multipartFileHeader(t, "icon.svg", "image/png", []byte("<svg onload='alert(1)'/>"))); err == nil {
		t.Fatal("active SVG accepted")
	}
	url, err := svc.UploadSocialBrandIcon(admin, multipartFileHeader(t, "icon.png", "text/plain", image))
	if err != nil {
		t.Fatal(err)
	}
	id := strings.TrimPrefix(url, socialBrandIconPrefix)
	if _, err := svc.PrepareSocialBrandIconDelivery(nil, id, ResourceAccessOptions{}, ""); err == nil {
		t.Fatal("unconfigured icon publicly readable")
	}
	request := httptest.NewRequest("PUT", "/", nil)
	update := socialauth.UpdateSettingsRequest{Providers: map[string]socialauth.UpdateProviderInput{"qq": {IconDarkURL: url}}}
	if _, err := svc.UpdateSocialAuthAdminSettings(request, admin, update); err != nil {
		t.Fatal(err)
	}
	delivery, err := svc.PrepareSocialBrandIconDelivery(nil, id, ResourceAccessOptions{}, "")
	if err != nil || delivery == nil {
		t.Fatalf("configured icon unavailable: %v", err)
	}
	if delivery.Stream == nil {
		t.Fatal("expected local stream")
	}
	defer delivery.Stream.Body.Close()
	content, err := io.ReadAll(delivery.Stream.Body)
	if err != nil || !bytes.Equal(content, image) {
		t.Fatalf("public bytes changed: %v", err)
	}
	if _, err := svc.PrepareResourceDelivery(user.ID, id, ResourceAccessOptions{}, ""); err == nil {
		t.Fatal("ordinary resource authorization bypassed")
	}
	if len(svc.appearanceResourceReferences([]string{id})[id]) == 0 {
		t.Fatal("configured icon not protected from deletion")
	}
	appearance, err := svc.Appearance()
	if err != nil || appearance.LogoURL != defaultAppearanceLogoURL {
		t.Fatal("social upload changed site logo")
	}
	other := *admin
	other.ID = "another-admin"
	if err := svc.validateSocialBrandIconSettings(&other, socialauth.UpdateSettingsRequest{Providers: map[string]socialauth.UpdateProviderInput{"google": {IconLightURL: url}}}); err == nil {
		t.Fatal("foreign upload accepted")
	}
	if _, err := svc.PrepareSocialBrandIconDelivery(user, id, ResourceAccessOptions{}, ""); err == nil {
		t.Fatal("non-admin preview accepted")
	}
	ordinary, err := svc.UploadAppearanceAsset(admin, "logo", multipartFileHeader(t, "private.png", "image/png", image))
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.validateSocialBrandIconSettings(admin, socialauth.UpdateSettingsRequest{Providers: map[string]socialauth.UpdateProviderInput{"qq": {IconLightURL: socialBrandIconPrefix + ordinary.ID}}}); err == nil {
		t.Fatal("ordinary resource accepted as brand icon")
	}
	update.Providers["qq"] = socialauth.UpdateProviderInput{}
	if _, err := svc.UpdateSocialAuthAdminSettings(request, admin, update); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PrepareSocialBrandIconDelivery(nil, id, ResourceAccessOptions{}, ""); err == nil {
		t.Fatal("cleared icon still publicly readable")
	}
}
