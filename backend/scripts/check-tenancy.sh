#!/usr/bin/env bash
# Tenancy guard: fails if a Prisma operation that cannot be tenant-scoped
# (unique-where ops) appears in route code. The runtime extension refuses
# these too — this catches them before anything ships.
set -euo pipefail
cd "$(dirname "$0")/.."

matches=$(grep -rnE '\.(findUnique|findUniqueOrThrow|update|delete|upsert)\(' src/routes --include='*.ts' \
  | grep -v 'platformPrisma' \
  | grep -vE 'router\.(get|post|put|delete|patch)\(' || true)

if [ -n "$matches" ]; then
  echo "FAIL — tenant-unsafe Prisma operations found in routes:" >&2
  echo "$matches" >&2
  echo "Use findFirst / updateMany / deleteMany, or platformPrisma for deliberate platform-level work." >&2
  exit 1
fi
echo "OK: no tenant-unsafe Prisma operations in routes."
