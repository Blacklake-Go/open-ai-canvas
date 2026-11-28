#!/bin/sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$source_dir/../../.." && pwd)
output=${STRIPE_PLUGIN_OUTPUT_DIR:-"$root/.local/cache/stripe-payment"}
mkdir -p "$output"
output=$(CDPATH= cd -- "$output" && pwd)
stage=$(mktemp -d "$output/build.XXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
mkdir -p "$stage/backend"
cp "$source_dir/manifest.json" "$source_dir/README.md" "$stage/"

for target in ${STRIPE_PLUGIN_TARGETS:-linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64}; do
  os=${target%/*}
  arch=${target#*/}
  file="provider-$os-$arch"
  case "$os" in windows) file="$file.exe";; esac
  (cd "$root/backend" && CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" go build -trimpath -ldflags="-s -w" -o "$stage/backend/$file" ./cmd/payment-stripe)
done

artifact=supdance-payment-stripe.yingce-plugin
(cd "$stage" && zip -X -q "$artifact" manifest.json README.md backend/*)
mv "$stage/$artifact" "$output/"
printf '%s\n' "$output/$artifact"
