#!/usr/bin/env bash
set -euo pipefail
cd /app
: "${DONEEO_PREVIEW_EXPIRES_AT:?Set an absolute UTC expiry for this test environment.}"
node -e 'const end=Date.parse(process.env.DONEEO_PREVIEW_EXPIRES_AT);if(!Number.isFinite(end))process.exit(1);if(end<=Date.now())process.exit(2)' || {
  status=$?
  if [ "$status" = 2 ]; then echo 'The test preview has expired.'; exit 0; fi
  echo 'DONEEO_PREVIEW_EXPIRES_AT must be a valid ISO date.' >&2; exit 1
}
data_root="${DONEEO_DATA_ROOT:-/data}"
mkdir -p "$data_root/customer" "$data_root/planner" /app/.wrangler /app/.sites-runtime
if [ "$(id -u)" = 0 ]; then
  chown -R doneeo:doneeo "$data_root" /app/.wrangler /app/.sites-runtime
  exec gosu doneeo /app/deploy/preview/entrypoint.sh
fi
if [ ! -e /app/.wrangler/state ] && [ ! -L /app/.wrangler/state ]; then
  ln -s "$data_root/planner" /app/.wrangler/state
fi
if [ "$(readlink -f /app/.wrangler/state)" != "$(readlink -f "$data_root/planner")" ]; then
  echo 'Planner state must point to the mounted preview data directory.' >&2; exit 1
fi
export DONEEO_DATA_DIR="$data_root/customer"
export DONEEO_EXECUTOR_DEMO=true
export DONEEO_PLANNER_STATE="$data_root/planner"
bash scripts/db-local.sh --keep
children=()
cleanup() { kill -TERM "${children[@]}" 2>/dev/null || true; wait "${children[@]}" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
node deploy/preview/planner.mjs & children+=("$!")
java -Xms64m -Xmx256m -jar customer-app/backend/app.jar \
  --server.servlet.session.cookie.secure="${DONEEO_COOKIE_SECURE:-true}" \
  --server.forward-headers-strategy=native & children+=("$!")
node deploy/preview/server.mjs & children+=("$!")
status=0
wait -n "${children[@]}" || status=$?
exit "$status"
