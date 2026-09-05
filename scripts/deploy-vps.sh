#!/bin/bash

set -euo pipefail

HRM_REPO_DIR="${HRM_REPO_DIR:-/var/www/6softhrm}"
HRM_FRONTEND_ROOT="${HRM_FRONTEND_ROOT:-/var/www/onsidehr.co.uk}"
MAIN_REPO_DIR="${MAIN_REPO_DIR:-/var/www/6soft-visionary-web}"
MAIN_SITE_ROOT="${MAIN_SITE_ROOT:-/var/www/6soft-main}"

echo "[deploy] updating HRM repo"
cd "$HRM_REPO_DIR"
git fetch origin
git checkout main
git pull --ff-only origin main

echo "[deploy] deploying HRM backend"
cd "$HRM_REPO_DIR/backend"
npm install
npx prisma generate

# Last point at which nothing has changed: the migrations below auto-commit
# their DDL and cannot be rolled back, and a backend missing FIELD_ENCRYPTION_KEY
# or JWT_SECRET crashloops on restart. Check the environment while production is
# still untouched and still serving.
echo "[deploy] checking backend environment"
# Whether anything is actually about to be migrated. The preflight refuses a
# stale backup only when it is — blocking a code-only release on it would just
# teach people to skip the check.
if npx prisma migrate status 2>&1 | grep -qiE "not yet been applied"; then
  export PREFLIGHT_PENDING_MIGRATIONS=1
  echo "[deploy] migrations are pending — a fresh backup is required"
else
  export PREFLIGHT_PENDING_MIGRATIONS=0
fi

if ! npm run --silent preflight; then
  echo "[deploy] ABORTED: the backend environment is incomplete." >&2
  echo "         No migrations were applied and the running API was not restarted." >&2
  echo "         Fix the variables listed above in $HRM_REPO_DIR/backend/.env, then re-run." >&2
  exit 1
fi

npx prisma migrate deploy
npm run build
# The process is defined as onsidehr-api in ecosystem.config.js, which is also
# what the runbook reloads. This line said 6soft-hrm-backend, a name PM2 does
# not know, so under `set -e` the deploy died here — after the migrations had
# already been applied. The old code carried on serving a migrated schema,
# which is the failure the preflight above exists to prevent, one step later.
# Start it from the ecosystem file if it is not running yet.
# Reload whichever name pm2 is actually running. Starting a second process
# while the first still holds the port would leave the new one dead on
# EADDRINUSE and the old one serving, which is worse than a clear failure.
API_PROCESS=""
for CANDIDATE in onsidehr-api 6soft-hrm-backend; do
  if pm2 describe "$CANDIDATE" > /dev/null 2>&1; then
    API_PROCESS="$CANDIDATE"
    break
  fi
done

if [ -n "$API_PROCESS" ]; then
  echo "[deploy] reloading pm2 process: $API_PROCESS"
  pm2 reload "$API_PROCESS" --update-env
else
  echo "[deploy] no API process found; starting onsidehr-api from ecosystem.config.js"
  pm2 start "$HRM_REPO_DIR/ecosystem.config.js" --only onsidehr-api
fi
pm2 save

echo "[deploy] deploying HRM frontend"
cd "$HRM_REPO_DIR/frontend"
npm install
npm run build
mkdir -p "$HRM_FRONTEND_ROOT"
rm -rf "${HRM_FRONTEND_ROOT:?}"/*
cp -r dist/* "$HRM_FRONTEND_ROOT/"
chown -R www-data:www-data "$HRM_FRONTEND_ROOT"

if [ "${DEPLOY_MAIN_SITE:-1}" = "1" ]; then
  echo "[deploy] updating main website repo"
  cd "$MAIN_REPO_DIR"
  git fetch origin
  git checkout main
  git pull --ff-only origin main

  # The website repo currently contains Linux case-sensitive import mismatches.
  sed -i 's|"\./pages/about"|"./pages/About"|g' src/App.tsx
  sed -i 's|"\./pages/Contact"|"./pages/contact"|g' src/App.tsx

  rm -rf node_modules package-lock.json
  npm install
  npm install -D @rollup/rollup-linux-x64-gnu
  npm run build

  rm -rf "${MAIN_SITE_ROOT:?}"/*
  cp -r dist/* "$MAIN_SITE_ROOT/"
  chown -R www-data:www-data "$MAIN_SITE_ROOT"
fi

echo "[deploy] syncing security-headers snippet"
install -m 644 "$HRM_REPO_DIR/nginx/6soft-security-headers.conf" \
  /etc/nginx/snippets/6soft-security-headers.conf

echo "[deploy] ensuring nginx server_tokens are disabled"
if ! grep -q '^[^#]*server_tokens off;' /etc/nginx/nginx.conf; then
  # Add server_tokens off inside the http{} block (idempotent).
  sed -i '/^http\s*{/a \\tserver_tokens off;' /etc/nginx/nginx.conf
fi

# Warn (don't auto-edit) if the live site config hasn't been wired to include
# the security-headers snippet yet. Manual one-time step on first deploy.
for SITE in /etc/nginx/sites-enabled/onsidehr.co.uk \
            /etc/nginx/sites-available/onsidehr.co.uk \
            /etc/nginx/sites-enabled/hrm.6soft.co.uk \
            /etc/nginx/sites-available/hrm.6soft.co.uk; do
  if [ -f "$SITE" ] && ! grep -q '6soft-security-headers.conf' "$SITE"; then
    echo "[deploy] WARNING: $SITE is missing"
    echo "         'include /etc/nginx/snippets/6soft-security-headers.conf;'"
    echo "         Add it inside each server { ... } block, then reload nginx."
  fi
done

echo "[deploy] reloading nginx"
nginx -t
systemctl reload nginx

echo "[deploy] done"
