#!/usr/bin/env bash
set -euo pipefail

DEVICE_UDID="${1:-$(xcrun simctl list devices | awk -F '[()]' '/Unloop iPhone 17/ {print $2; exit}')}"
OUTPUT_DIR="${2:-/tmp/couponly-ui-screenshots}"

if [[ -z "${DEVICE_UDID}" ]]; then
  echo "No iOS simulator UDID found. Pass one as the first argument." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
xcrun simctl bootstatus "${DEVICE_UDID}" -b

routes=(
  "home:/kouponly"
  "search:/kouponly/search"
  "map:/kouponly/map"
  "saved:/kouponly/saved"
  "profile:/kouponly/profile"
  "history:/kouponly/history"
  "category:/kouponly/category/market-food"
  "vendor:/kouponly/vendor/catalogue-vendor-1"
  "welcome:/kouponly/welcome"
  "login:/kouponly/onboarding?flow=login"
)

for item in "${routes[@]}"; do
  name="${item%%:*}"
  route="${item#*:}"
  xcrun simctl openurl "${DEVICE_UDID}" "kouponly://${route}" >/dev/null
  sleep 2
  xcrun simctl io "${DEVICE_UDID}" screenshot "${OUTPUT_DIR}/${name}.png" >/dev/null
  echo "Captured ${OUTPUT_DIR}/${name}.png"
done
