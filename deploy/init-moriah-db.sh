#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
CREATE ROLE moriah_app LOGIN PASSWORD :'app_password';
CREATE DATABASE moriah OWNER moriah_app;
SQL
