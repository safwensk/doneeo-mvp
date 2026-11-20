$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$engineDirectory = & node.exe (Join-Path $PSScriptRoot 'Resolve-Planner.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not locate the canonical planner.' }
Set-Location -LiteralPath $engineDirectory
if (!(Test-Path -LiteralPath node_modules/.bin/vite.cmd)) {
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Planner dependency installation failed.' }
}
New-Item -ItemType Directory -Path .wrangler -Force | Out-Null
@'
name = "doneeo-local-intelligence"
main = "../worker/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
[[d1_databases]]
binding = "DB"
database_name = "site-creator-d1"
database_id = "00000000-0000-4000-8000-000000000000"
migrations_dir = "../drizzle"
'@ | Set-Content -LiteralPath .wrangler/local-migrations.toml -Encoding ascii
$env:CI = 'true'
$env:WRANGLER_WRITE_LOGS = 'false'
& node_modules/.bin/wrangler.cmd d1 migrations apply DB --local --config .wrangler/local-migrations.toml --persist-to .wrangler/state
if ($LASTEXITCODE -ne 0) { throw 'The local planner database could not be prepared.' }
& npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
exit $LASTEXITCODE
