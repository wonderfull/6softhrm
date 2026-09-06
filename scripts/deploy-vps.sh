#!/bin/bash

set -euo pipefail

HRM_REPO_DIR="${HRM_REPO_DIR:-/var/www/6softhrm}"
HRM_FRONTEND_ROOT="${HRM_FRONTEND_ROOT:-/var/www/onsidehr.co.uk}"
# The pre-rebrand address still has its own nginx site and its own directory.
# It is refreshed with the same build so there is never a stale copy of the
# product on a public URL.
HRM_LEGACY_FRONTEND_ROOT="${HRM_LEGACY_FRONTEND_ROOT:-/var/www/hrm.6soft.co.uk}"
MAIN_REPO_DIR="${MAIN_REPO_DIR:-/var/www/6soft-visionary-web}"
MAIN_SITE_ROOT="${MAIN_SITE_ROOT:-/var/www/6soft-main}"

# npm ci deletes node_modules itself, and a deploy interrupted mid-install
# leaves it in a state where that delete fails with ENOTEMPTY. One clean retry
# turns a stuck server into a normal install instead of a failed release.
install_deps() {
  if npm ci; then
    return 0
  fi
  echo "[deploy] npm ci failed in $(pwd); clearing node_modules and retrying once"
  rm -rf node_modules
  npm ci
}

echo "[deploy] updating HRM repo"
cd "$HRM_REPO_DIR"
git fetch origin
git checkout main
# `npm install` rewrites the lockfiles in place, and those local edits then
# block the next `git pull` — a deploy that changes a dependency locks the
# server out of the following one. They are generated files here, never
# authored, so discard them before pulling.
git checkout -- backend/package-lock.json frontend/package-lock.json 2>/dev/null || true
git pull --ff-only origin main

echo "[deploy] deploying HRM backend"
cd "$HRM_REPO_DIR/backend"
install_deps
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
install_deps
npm run build
mkdir -p "$HRM_FRONTEND_ROOT"
rm -rf "${HRM_FRONTEND_ROOT:?}"/*
cp -r dist/* "$HRM_FRONTEND_ROOT/"
chown -R www-data:www-data "$HRM_FRONTEND_ROOT"

if [ -d "$HRM_LEGACY_FRONTEND_ROOT" ]; then
  echo "[deploy] refreshing the legacy hrm.6soft.co.uk copy"
  rm -rf "${HRM_LEGACY_FRONTEND_ROOT:?}"/*
  cp -r dist/* "$HRM_LEGACY_FRONTEND_ROOT/"
  chown -R www-data:www-data "$HRM_LEGACY_FRONTEND_ROOT"
fi

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

# Wire the snippet into the live site configs. This used to only warn, and the
# warning was worded as though the file were missing rather than the include —
# so it read as noise and nothing was ever done about it. The result: the API
# had helmet's headers while the HTML document, which is what actually needs
# frame-ancestors and a CSP, was served by nginx with none at all.
#
# Editing nginx on a live server earns a backup, a config test and a rollback.
SECURITY_INCLUDE='    include /etc/nginx/snippets/6soft-security-headers.conf;'
NGINX_EDITED=""
NGINX_SEEN=""

for SITE in /etc/nginx/sites-enabled/onsidehr.co.uk \
            /etc/nginx/sites-available/onsidehr.co.uk \
            /etc/nginx/sites-enabled/hrm.6soft.co.uk \
            /etc/nginx/sites-available/hrm.6soft.co.uk; do
  [ -e "$SITE" ] || continue
  # sites-enabled entries are usually symlinks to sites-available; edit once.
  REAL=$(readlink -f "$SITE")
  case " $NGINX_SEEN " in *" $REAL "*) continue ;; esac
  NGINX_SEEN="$NGINX_SEEN $REAL"

  if grep -q '6soft-security-headers.conf' "$REAL"; then
    continue
  fi

  echo "[deploy] adding the security-headers include to $REAL"
  cp -a "$REAL" "$REAL.pre-headers.bak"
  # Every server block gets it, including the :80 redirect — harmless there.
  sed -i "/^[[:space:]]*server_name/a\\$SECURITY_INCLUDE" "$REAL"
  NGINX_EDITED="$NGINX_EDITED $REAL"
done

if [ -n "$NGINX_EDITED" ] && ! nginx -t 2>/dev/null; then
  echo "[deploy] nginx rejected the security-headers include; rolling back" >&2
  for REAL in $NGINX_EDITED; do
    mv "$REAL.pre-headers.bak" "$REAL"
  done
  nginx -t
  echo "[deploy] site configs restored; headers NOT applied — investigate" >&2
fi

echo "[deploy] reloading nginx"
nginx -t
systemctl reload nginx

echo "[deploy] done"
