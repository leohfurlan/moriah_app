#!/usr/bin/env bash
# Local database + private media snapshot. Run while write traffic is paused
# when a strictly consistent database/files snapshot is required.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
umask 077
dc() { docker compose -p moriah-piloto -f docker-compose.pilot.yml \
    -f docker-compose.kinghost.yml --env-file .env.pilot "$@"; }
backup_dir="${MORIAH_BACKUP_DIR:-/var/backups/moriah}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$backup_dir/database-$stamp.dump"
media="$backup_dir/media-$stamp.tar.gz"
trap 'rm -f "$dump.partial" "$media.partial"; echo "Moriah backup failed" >&2' ERR
dc exec -T db sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -U "$POSTGRES_USER" -d moriah --no-owner --no-acl --format=custom' > "$dump.partial"
dc exec -T db pg_restore --list < "$dump.partial" > /dev/null
dc exec -T backend tar -czf - -C /app media > "$media.partial"
tar -tzf "$media.partial" > /dev/null
mv "$dump.partial" "$dump"
mv "$media.partial" "$media"
sha256sum "$dump" "$media" > "$backup_dir/checksums-$stamp.txt"
date -u +%FT%TZ > "$backup_dir/last-success.txt"
# Retention only touches the exact artifact names created by this script.
find "$backup_dir" -maxdepth 1 -type f \( -name 'database-*.dump' -o -name 'media-*.tar.gz' -o -name 'checksums-*.txt' \) -mtime +30 -delete
echo "Moriah database and media backup verified: $stamp"
