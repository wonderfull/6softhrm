#!/bin/bash

set -euo pipefail

HRM_REPO_DIR="${HRM_REPO_DIR:-/var/www/6softhrm}"
HRM_FRONTEND_ROOT="${HRM_FRONTEND_ROOT:-/var/www/hrm.6soft.co.uk}"
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
npx prisma migrate deploy
npm run build
pm2 restart 6soft-hrm-backend --update-env

echo "[deploy] deploying HRM frontend"
cd "$HRM_REPO_DIR/frontend"
npm install
npm run build
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
for SITE in /etc/nginx/sites-enabled/hrm.6soft.co.uk \
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
