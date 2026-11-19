# Persistent Doneeo test preview

This container runs the existing customer frontend, Spring Boot API and canonical compiled Worker together. The site visuals and customer workflow are unchanged. Only the static customer website and authenticated Java gateway are public; the native planner listens on loopback.

The Worker uses the same Miniflare engine as local development, without the Vite development server. The runtime is pinned to the version already in the lockfile. The original root app and its independent model validation remain authoritative.

## Deployment

1. Deploy this repository's `codex/customer-conversation-workspace` branch using `Dockerfile.preview`. `railway.json` contains the build, health and single-instance restart configuration.
2. Attach one persistent volume at `/data`. Both the customer SQLite database and canonical D1 state live there. Keep one replica; these local databases are not shared among replicas.
3. Set `DONEEO_PREVIEW_EXPIRES_AT` to an absolute UTC ISO timestamp one week after the preview is enabled. The app stops its services with a successful exit at that deadline. The configured `ON_FAILURE` policy does not restart a successful completion. Do not enable an always-restart policy for this preview.
4. Supply existing optional model/Maps credentials as private service environment variables. Keep secrets out of Docker build arguments and public `VITE_*` variables. The compiled image contains no credentials. Provider availability and quota still apply.
5. Generate the platform's HTTPS public domain. Leave `DONEEO_COOKIE_SECURE=true`; `false` exists only for the local HTTP container test. The public port follows the platform's `PORT` variable, defaulting to 3000.

Migrations apply without resetting existing work. Accounts and discussion survive process/container restarts when `/data` remains mounted. Sessions are in Java memory, so a restarted server requires logging in again. A fresh deployment volume starts with fresh test accounts; it does not contain the laptop's customer records.

`GET /healthz` checks both backends. `GET /__preview` shows the deployment commit and expiry without exposing settings. Native architecture, provider and test-control pages remain local development tools; they are not published through this customer gateway. Their account-menu links appear only on localhost.

At expiry the service stops, but this does not cancel a hosting subscription or delete its persistent volume. Any plan minimum or retained storage charge remains subject to the host's billing. Review that before activating paid hosting; a user-approved account limit must also cover any other account projects. This is a test deployment, not a production launch.

## Local container check

```sh
docker build -f Dockerfile.preview -t doneeo-preview .
docker volume create doneeo-preview-data
docker run --name doneeo-preview -p 3000:3000 \
  -v doneeo-preview-data:/data \
  -e DONEEO_COOKIE_SECURE=false \
  -e DONEEO_PREVIEW_EXPIRES_AT=REPLACE_WITH_A_FUTURE_UTC_ISO_TIMESTAMP \
  doneeo-preview
```

GitHub CI builds the actual image, checks public/authenticated planning, removes and replaces the container, and checks saved conversation plus native WorkCase recovery from the same volume. This checks the mounted storage rather than relying on the old container's writable layer. The checks use fictional account data and deterministic planning without paid model calls.

Provider identities, availability/prices, checkout and execution progress remain prototype simulations. No real charge or provider dispatch occurs.
