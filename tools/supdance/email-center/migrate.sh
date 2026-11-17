#!/usr/bin/env bash
set -euo pipefail

# This wrapper never selects a database implicitly or prints its connection string.
action="${1:-status}"
case "$action" in status|verify|up) ;; *) echo "Usage: migrate.sh [status|verify|up]" >&2; exit 2 ;; esac
: "${CANVAS_DATABASE_DRIVER:?Set the actual database driver explicitly}"
case "$CANVAS_DATABASE_DRIVER" in
  postgres) : "${DATABASE_URL:?Provide the intended PostgreSQL connection through the environment}" ;;
  sqlite) : "${CANVAS_BACKEND_DATA_DIR:?Provide an isolated or backed-up SQLite data directory}" ;;
  *) echo "Unsupported database driver" >&2; exit 2 ;;
esac
task_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$task_root/backend"
exec go run ./cmd/migrate-schema "$action"
