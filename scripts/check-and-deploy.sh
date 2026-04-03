#!/bin/bash

set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/check-and-deploy.log}"
HRM_REPO="${HRM_REPO:-/var/www/6softhrm}"
MAIN_REPO="${MAIN_REPO:-/var/www/6soft-visionary-web}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT:-/var/www/6softhrm/scripts/deploy-vps.sh}"

needs_deploy=0

check_repo() {
  local repo_dir="$1"
  cd "$repo_dir"
  git fetch origin main >/dev/null 2>&1

  local local_sha remote_sha
  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git rev-parse origin/main)

  if [ "$local_sha" != "$remote_sha" ]; then
    needs_deploy=1
  fi
}

check_repo "$HRM_REPO"
check_repo "$MAIN_REPO"

if [ "$needs_deploy" -eq 1 ]; then
  echo "[$(date -Is)] changes detected, deploying" >> "$LOG_FILE"
  bash "$DEPLOY_SCRIPT" >> "$LOG_FILE" 2>&1
else
  echo "[$(date -Is)] no changes" >> "$LOG_FILE"
fi
