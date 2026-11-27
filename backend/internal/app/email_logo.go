package app

import (
	"bytes"
	_ "embed"
	_ "golang.org/x/image/webp"
	"image"
	"image/png"
	"net/http"
	"yingce/backend/internal/kernel"
)

// Keep the embedded artwork byte-for-byte with web/public/supdance-footer-logo.png.
//
//go:embed supdance-footer-logo.png
var supDanceFooterMailLogo []byte

// The site permits WebP. Encode that same graphic as PNG for mail, retaining
// dimensions, aspect ratio and transparency rather than substituting a mark.
func normalizeMailLogo(data []byte) ([]byte, string, error) {
	kind := http.DetectContentType(data)
	if kind == "image/webp" {
		config, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > 16_000_000 {
			return nil, "", kernel.BadAuthRequest("站点 Logo 图片无效或像素过大")
		}
		graphic, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, "", err
		}
		var out bytes.Buffer
		if err := png.Encode(&out, graphic); err != nil {
			return nil, "", err
		}
		if out.Len() > int(appearanceLogoMaxBytes) {
			return nil, "", kernel.BadAuthRequest("邮件 Logo 超出限制")
		}
		return out.Bytes(), "image/png", nil
	}
	if kind != "image/png" && kind != "image/jpeg" && kind != "image/gif" {
		return nil, "", kernel.BadAuthRequest("邮件 Logo 格式无效")
	}
	return data, kind, nil
}
