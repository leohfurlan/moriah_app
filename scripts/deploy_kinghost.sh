#!/usr/bin/env bash
# Run after loading both immutable images and completing backup/acceptance.
# Does not build images, seed data, create accounts or change the shared proxy.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
revision="${1:?Usage: deploy_kinghost.sh VALIDATED_REVISION}"
[[ "$revision" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || exit 2
export APP_REVISION="$revision"
dc() { docker compose -p moriah-piloto -f docker-compose.pilot.yml \
    -f docker-compose.kinghost.yml --env-file .env.pilot "$@"; }
test -f .env.pilot
if grep -q 'REPLACE_WITH_' .env.pilot; then
    echo 'Fill all environment placeholders before deployment.' >&2
    exit 1
fi
for image in "moriah-backend:$revision" "moriah-web:$revision"; do
    image_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")"
    if [[ "$image_revision" != "$revision" ]]; then
        echo "Image $image does not match the validated revision." >&2
        exit 1
    fi
done
docker network inspect moriah_piloto_edge >/dev/null
dc config --quiet
dc up -d --wait --wait-timeout 120 db
dc --profile tools run --rm migrate python manage.py check --deploy --tag security --fail-level WARNING
dc --profile tools run --rm migrate python manage.py migrate --plan
if [[ "${MORIAH_BACKUP_VERIFIED:-}" != yes ]]; then
    echo 'Set MORIAH_BACKUP_VERIFIED=yes after verifying the backup (or empty first-deploy database).' >&2
    exit 1
fi
dc --profile tools run --rm migrate
dc --profile tools run --rm migrate python manage.py sync_role_permissions
dc up -d --no-build --wait --wait-timeout 120 backend web
# Readiness runs once here, rather than continuously waking the database.
dc exec -T backend curl -fsS http://localhost:8000/health/ready/ | \
    python3 -c 'import json,sys; p=json.load(sys.stdin); assert p["status"]=="ready" and p["revision"]==sys.argv[1], p; print("Readiness and revision verified")' "$revision"
# Persist the revision only after startup; systemd uses this same env file.
python3 - "$revision" <<'PY'
import pathlib, re, sys
path = pathlib.Path('.env.pilot')
body = path.read_text()
line = 'APP_REVISION=' + sys.argv[1]
body = re.sub(r'^APP_REVISION=.*$', line, body, flags=re.M) if re.search(r'^APP_REVISION=', body, re.M) else body.rstrip() + '\n' + line + '\n'
path.write_text(body)
PY
echo "Release $revision started. Validate HTTPS, login, files and existing services before admitting users."
