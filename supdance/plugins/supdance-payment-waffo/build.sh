#!/bin/sh
set -eu
cd "$(dirname "$0")"
source_dir=$(pwd)
output_dir="$source_dir/../../../.local/cache/waffo-pancake"
mkdir -p "$output_dir"
stage=$(mktemp -d "$output_dir/build.XXXXXX")
trap 'rm -rf "$stage"' EXIT

npm ci --ignore-scripts --no-audit --no-fund
mkdir -p "$stage/backend"
bun build rpc.ts --target=node --format=cjs --outfile="$stage/backend/rpc.cjs"
cp node_modules/@waffo/pancake-ts/LICENSE "$stage/LICENSE"
cp manifest.json README.md "$stage/"
cp provider "$stage/backend/provider"
chmod 755 "$stage/backend/provider"
(
  cd "$stage"
  zip -X -q "$stage/supdance-payment-waffo.yingce-plugin" manifest.json README.md LICENSE backend/provider backend/rpc.cjs
)
mv "$stage/supdance-payment-waffo.yingce-plugin" "$output_dir/"
printf '%s\n' "$(cd "$output_dir" && pwd)/supdance-payment-waffo.yingce-plugin"
