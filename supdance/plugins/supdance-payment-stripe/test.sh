#!/bin/sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$source_dir/../../.." && pwd)
package=${SUPDANCE_STRIPE_PLUGIN_PACKAGE:-}
if [ -z "$package" ]; then
  output=$(mktemp -d "${TMPDIR:-/tmp}/supdance-stripe-test.XXXXXX")
  trap 'rm -f "$output/supdance-payment-stripe.yingce-plugin"; rmdir "$output"' EXIT
  target="$(go env GOHOSTOS)/$(go env GOHOSTARCH)"
  package=$(STRIPE_PLUGIN_TARGETS="$target" STRIPE_PLUGIN_OUTPUT_DIR="$output" sh "$source_dir/build.sh")
fi
cd "$root/backend"
SUPDANCE_STRIPE_PLUGIN_PACKAGE="$package" go test ./internal/supdance/stripepayment/... -run Stripe -count=1
