#!/usr/bin/env bash
# Restore a gzipped dump into a target database.
#   scripts/restore-db.sh backups/onsidehr-xxx.sql.gz "mysql://user:pass@host:3306/target_db"
# The target database is created if missing. NEVER point this at production
# unless you mean it — it replaces the schema contents wholesale.
set -euo pipefail

DUMP="$1"
TARGET_URL="$2"
[ -f "$DUMP" ] || { echo "dump not found: $DUMP" >&2; exit 1; }

proto_removed="${TARGET_URL#mysql://}"
creds="${proto_removed%%@*}"
hostpart="${proto_removed#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
DB_HOST="${hostpart%%[:/]*}"
rest="${hostpart#*[:/]}"
case "$hostpart" in
  *:*) DB_PORT="${rest%%/*}"; DB_NAME="${hostpart##*/}" ;;
  *)   DB_PORT=3306;          DB_NAME="${hostpart#*/}" ;;
esac

echo "[RESTORE] ${DUMP} -> ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
START=$(date +%s)
export MYSQL_PWD="$DB_PASS"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`"
gunzip -c "$DUMP" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
echo "[RESTORE] completed in $(( $(date +%s) - START ))s"
