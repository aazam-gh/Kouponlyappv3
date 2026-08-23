#!/usr/bin/env bash
set -euo pipefail

DEVICE_UDID="${1:-$(xcrun simctl list devices | awk -F '[()]' '/Unloop iPhone 17/ {print $2; exit}')}"
OUTPUT_DIR="${2:-/tmp/kouponly-ui-screenshots}"

if [[ -z "${DEVICE_UDID}" ]]; then
  echo "No iOS simulator UDID found. Pass one as the first argument." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
xcrun simctl bootstatus "${DEVICE_UDID}" -b

routes=(
  "home:/"
  "search:/(tabs)/search"
  "map:/(tabs)/map"
  "saved:/(tabs)/saved"
  "me:/(tabs)/me"
  "work:/work"
  "rewards:/rewards"
  "auth:/auth"
  "settings:/account/settings"
  "category:/category/mains"
  "deal:/deal/1"
  "listing:/listing/backwater-cruise"
)

for item in "${routes[@]}"; do
  name="${item%%:*}"
  route="${item#*:}"
  xcrun simctl openurl "${DEVICE_UDID}" "com.kouponly.app://${route}" >/dev/null
  sleep 1
  xcrun simctl io "${DEVICE_UDID}" screenshot "${OUTPUT_DIR}/${name}.png" >/dev/null
  echo "Captured ${OUTPUT_DIR}/${name}.png"
done
