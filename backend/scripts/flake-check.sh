#!/usr/bin/env bash
# Repeat the backend suite to smoke out order- and timing-dependent failures.
#
#   npm run test:flake        # 5 runs
#   npm run test:flake -- 20  # 20 runs
#
# Prints one line per run and stops at the first failure, naming the tests
# that failed — the full output stays in the log file it points at.
set -uo pipefail
cd "$(dirname "$0")/.."
RUNS=${1:-5}
LOG_DIR=$(mktemp -d)

for i in $(seq 1 "$RUNS"); do
  log="$LOG_DIR/run-$i.log"
  if npx jest --silent > "$log" 2>&1; then
    echo "run $i/$RUNS: pass"
  else
    echo "run $i/$RUNS: FAIL"
    grep -E '^  ● ' "$log" | grep -v '● Console' | sort -u | head -10
    echo "full output: $log"
    exit 1
  fi
done
echo "$RUNS/$RUNS clean"
