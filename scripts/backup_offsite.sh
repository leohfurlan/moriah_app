#!/usr/bin/env bash
# No implicit init, prune, source env, remote destination, or notifications.
# restic encrypts repository content and metadata; credentials remain host-only.
set -euo pipefail
umask 077
: "${RESTIC_REPOSITORY:?Select an approved repository first}"
: "${RESTIC_PASSWORD_FILE:?Provide the separately held repository password file}"
backup_dir="${MORIAH_BACKUP_DIR:-/var/backups/moriah}"
state_dir="${MORIAH_BACKUP_STATE_DIR:-/var/lib/moriah-backup}"
test -r "$RESTIC_PASSWORD_FILE"
test -d "$backup_dir"
mkdir -p "$state_dir"
exec 9>"$state_dir/offsite.lock"
flock -n 9 || exit 75
# Upload only one verified pair, never credentials or arbitrary host files.
stamp="$(find "$backup_dir" -maxdepth 1 -type f -name 'checksums-*.txt' -printf '%f\n' | sort | tail -n1)"
[[ "$stamp" =~ ^checksums-([0-9]{8}T[0-9]{6}Z)\.txt$ ]] || { echo 'No verified backup pair.' >&2; exit 1; }
id="${BASH_REMATCH[1]}"
cd "$backup_dir"
test -f "database-$id.dump"
test -f "media-$id.tar.gz"
sha256sum --check "$stamp" >/dev/null
# Source freshness is checked separately; a successful upload cannot hide an old dump.
test "$(($(date +%s) - $(date -d "${id:0:8} ${id:9:2}:${id:11:2}:${id:13:2} UTC" +%s)))" -lt 93600
trap 'echo "Moriah encrypted backup failed" >&2' ERR
restic backup --quiet --host moriah --tag moriah-verified-pair -- "database-$id.dump" "media-$id.tar.gz" "$stamp"
restic check --quiet
date -u +%FT%TZ > "$state_dir/last-offsite-success.partial"
mv "$state_dir/last-offsite-success.partial" "$state_dir/last-offsite-success"
echo 'Moriah encrypted backup verified.'
