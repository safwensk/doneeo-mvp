#!/usr/bin/env bash
#
# Apply every migration to the LOCAL D1 that `npm run dev` uses.
#
# vite.config.ts builds its Cloudflare binding config inline and does not set a
# migrations_dir, so a fresh checkout starts with a database that has no tables
# and every API call fails on "no such table". This closes that gap.
#
#   npm run db:local            # rebuild the local database, then migrate
#   npm run db:local -- --keep  # migrate without rebuilding
#
# The default rebuilds because the local database holds nothing but fixtures.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config="${project_root}/.wrangler/local-migrations.toml"
# The dev server's own D1 lives here. wrangler otherwise derives its persist
# path from the CONFIG file's directory, which silently creates a SECOND
# database — migrations apply cleanly to a database nothing reads.
persist="${project_root}/.wrangler/state"
mkdir -p "$(dirname "${config}")" "${persist}"

# Written rather than committed: it exists only to give the wrangler CLI the
# same binding vite.config.ts constructs in memory, and migrations_dir must be
# absolute because wrangler resolves it against the config file's own location.
cat > "${config}" <<TOML
name = "doneeo-local"
main = "worker/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "site-creator-d1"
database_id = "00000000-0000-4000-8000-000000000000"
migrations_dir = "${project_root}/drizzle"
TOML

# A checkout that ran an older dev server can hold tables that predate
# migration tracking: real tables, empty d1_migrations. wrangler then tries to
# create them again and fails on the first CREATE TABLE. This is purely local
# fixture data — seed_console_demo and reset_test_data repopulate it — so the
# honest move is to rebuild rather than to leave someone stuck.
d1_dir="${persist}/v3/d1/miniflare-D1DatabaseObject"
if [ -d "${d1_dir}" ] && [ "${1:-}" != "--keep" ]; then
  echo "Resetting the local dev database (fixture data only)…"
  rm -f "${d1_dir}"/*.sqlite "${d1_dir}"/*.sqlite-shm "${d1_dir}"/*.sqlite-wal
fi

echo "Applying migrations to the local D1…"
bash "${project_root}/scripts/sites-env.sh" -- \
  npx wrangler d1 migrations apply DB --local \
    --config "${config}" --persist-to "${persist}"

echo
echo "Local database ready. Now:"
echo "  npm run dev     then open http://localhost:5173/console"
