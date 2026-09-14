#!/usr/bin/env bash
#
# Restauracao de um backup do Moriah App.
#
# IMPORTANTE: por padrao restaura para um banco de teste
# ("<POSTGRES_DB>_restore_test"), nunca por cima do banco de producao. Assim o
# teste de restauracao — exigido antes do piloto — nao corre risco de destruir
# dados reais por engano.
#
# Uso:
#   ./scripts/restore_postgres.sh backups/moriah-20260822-020000.dump
#   TARGET_DB=moriah ALLOW_PRODUCTION=yes ./scripts/restore_postgres.sh <arquivo>

set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Uso: $0 <arquivo.dump>" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-moriah}"
POSTGRES_USER="${POSTGRES_USER:-moriah}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [[ "$POSTGRES_HOST" == "db" && -z "${FORCE_DB_HOST:-}" ]]; then
  POSTGRES_HOST="localhost"
fi

TARGET_DB="${TARGET_DB:-${POSTGRES_DB}_restore_test}"

# Trava de seguranca: restaurar por cima do banco real exige intencao explicita.
if [[ "$TARGET_DB" == "$POSTGRES_DB" && "${ALLOW_PRODUCTION:-no}" != "yes" ]]; then
  echo "Recusado: restaurar sobre '$POSTGRES_DB' apagaria os dados atuais." >&2
  echo "Se e realmente isso que voce quer, rode com ALLOW_PRODUCTION=yes." >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD:-moriah}"
PSQL=(psql --host="$POSTGRES_HOST" --port="$POSTGRES_PORT" --username="$POSTGRES_USER" --dbname=postgres)

echo "[restore] recriando banco '$TARGET_DB'"
"${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
"${PSQL[@]}" -c "CREATE DATABASE \"$TARGET_DB\" OWNER \"$POSTGRES_USER\";"

echo "[restore] restaurando $DUMP_FILE"
pg_restore \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$TARGET_DB" \
  --no-owner \
  --exit-on-error \
  "$DUMP_FILE"

# Conferencia rapida: o backup so vale se os dados criticos vieram junto.
echo "[restore] conferindo contagens:"
"${PSQL[@]/--dbname=postgres/--dbname=$TARGET_DB}" -c \
  "SELECT 'membros' AS tabela, count(*) FROM members_member
   UNION ALL SELECT 'contribuicoes', count(*) FROM finance_contribution
   UNION ALL SELECT 'anexos', count(*) FROM finance_contributionattachment
   UNION ALL SELECT 'usuarios', count(*) FROM accounts_user;"

echo "[restore] concluido em '$TARGET_DB'"
