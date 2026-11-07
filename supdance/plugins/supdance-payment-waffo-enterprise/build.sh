#!/bin/sh
set -eu
cd "$(dirname "$0")"
plugin_dir=$(pwd)
root=$(cd ../../.. && pwd)
output="$root/.local/cache/waffo-enterprise"
mkdir -p "$output"
stage=$(mktemp -d "$output/build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/backend"
for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64; do
  os=${target%/*}
  arch=${target#*/}
  file="provider-$os-$arch"
  if [ "$os" = windows ]; then file="$file.exe"; fi
  (cd "$root/backend"; CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" go build -trimpath -ldflags="-s -w" -o "$stage/backend/$file" ./cmd/payment-waffo-enterprise)
done
cp "$plugin_dir/manifest.json" "$plugin_dir/README.md" "$stage/"
(cd "$stage"; zip -X -q "$stage/supdance-payment-waffo-enterprise.yingce-plugin" manifest.json README.md backend/*)
mv "$stage/supdance-payment-waffo-enterprise.yingce-plugin" "$output/"
echo "$output/supdance-payment-waffo-enterprise.yingce-plugin"
