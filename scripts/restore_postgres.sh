#!/usr/bin/env bash
#
# Restauracao de um backup do Moriah App.
#
# IMPORTANTE: por padrao restaura para um banco de teste
# ("<POSTGRES_DB>_restore_test"), nunca por cima do banco de producao. Assim o
# ensaio de restauracao — exigido antes do piloto — nao corre risco de destruir
# dados reais por engano.
#
# Uso:
#   ./scripts/restore_postgres.sh backups/moriah-20260822-020000.dump
#   TARGET_DB=moriah ALLOW_PRODUCTION=yes ./scripts/restore_postgres.sh <arquivo>
#
# Banco remoto (piloto no Neon): o .env precisa ter POSTGRES_SSLMODE=require;
# o script recusa conectar sem TLS em host remoto.
#
# Ao final compara as contagens das tabelas criticas entre origem e destino:
# um backup que restaura mas perde dinheiro registrado nao serve.

set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Uso: $0 <arquivo.dump>" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"

# Variaveis ja exportadas no ambiente vencem o .env (ver backup_postgres.sh).
_externas=""
for _v in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_HOST POSTGRES_PORT POSTGRES_SSLMODE TARGET_DB ALLOW_PRODUCTION BACKUP_ALERT_WEBHOOK; do
  if [[ -n "${!_v+set}" ]]; then
    _externas+="export $_v=$(printf '%q' "${!_v}")"$'\n'
  fi
done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# O que veio do ambiente vence o .env.
if [[ -n "$_externas" ]]; then eval "$_externas"; fi

POSTGRES_DB="${POSTGRES_DB:-moriah}"
POSTGRES_USER="${POSTGRES_USER:-moriah}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
PORT="${POSTGRES_PORT}"
ALLOW_PRODUCTION="${ALLOW_PRODUCTION:-no}"

avisar() {
  echo "[restore] $(date -Iseconds) $1" >&2
  if [[ -n "${BACKUP_ALERT_WEBHOOK:-}" ]]; then
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      --data "{\"text\":\"[restore][moriah] $1 (host $(hostname))\"}" \
      "$BACKUP_ALERT_WEBHOOK" > /dev/null 2>&1 \
      || echo "[restore] aviso: webhook de alerta nao pode ser chamado" >&2
  fi
}

trap 'avisar "FALHA no ensaio de restauracao (linha $LINENO: $BASH_COMMAND)"' ERR

# --- TLS ---------------------------------------------------------------------
# Mesma regra do backup: host remoto exige TLS explicito (Neon).
PGSSLMODE="${POSTGRES_SSLMODE:-prefer}"
export PGSSLMODE
case "$POSTGRES_HOST" in
  localhost | 127.0.0.1 | db | "") DB_LOCAL="sim" ;;
  *) DB_LOCAL="nao" ;;
esac
if [[ "$DB_LOCAL" == "nao" && ! "$PGSSLMODE" =~ ^(require|verify-ca|verify-full)$ ]]; then
  avisar "banco remoto ($POSTGRES_HOST) com PGSSLMODE=$PGSSLMODE; use POSTGRES_SSLMODE=require"
  exit 1
fi

if [[ "$POSTGRES_HOST" == "db" && -z "${FORCE_DB_HOST:-}" ]]; then
  POSTGRES_HOST="localhost"
fi

TARGET_DB="${TARGET_DB:-${POSTGRES_DB}_restore_test}"

# Trava de seguranca: restaurar por cima do banco real exige intencao explicita.
if [[ "$TARGET_DB" == "$POSTGRES_DB" && "$ALLOW_PRODUCTION" != "yes" ]]; then
  echo "Recusado: restaurar sobre '$POSTGRES_DB' apagaria os dados atuais." >&2
  echo "Se e realmente isso que voce quer, rode com ALLOW_PRODUCTION=yes." >&2
  exit 1
fi

# --- Cliente -----------------------------------------------------------------
# No cenario local o banco esta no Compose e da para usar o container; com o
# banco gerenciado (Neon) o cliente tem de existir no host.
DB_SERVICE="${DB_SERVICE:-db}"
export PGPASSWORD="${POSTGRES_PASSWORD:-moriah}"
PGPASS_ARG=(-e PGPASSWORD)
if command -v psql > /dev/null 2>&1 && command -v pg_restore > /dev/null 2>&1; then
  RUNNER=()
  DB_TARGET_HOST="$POSTGRES_HOST"
elif [[ "$DB_LOCAL" == "sim" ]] && docker compose --project-directory "$REPO_DIR" ps "$DB_SERVICE" > /dev/null 2>&1; then
  echo "[restore] psql/pg_restore nao encontrados no host; usando o container '$DB_SERVICE'"
  RUNNER=(docker compose --project-directory "$REPO_DIR" exec -T "${PGPASS_ARG[@]}" "$DB_SERVICE")
  DB_TARGET_HOST="localhost"
else
  avisar "psql/pg_restore nao encontrados no host e o banco '$POSTGRES_HOST' nao esta no Compose"
  exit 1
fi

PSQL=("${RUNNER[@]}" psql --host="$DB_TARGET_HOST" --port="$PORT" --username="$POSTGRES_USER" --dbname=postgres)
PSQL_DEST=("${RUNNER[@]}" psql --host="$DB_TARGET_HOST" --port="$PORT" --username="$POSTGRES_USER" --dbname="$TARGET_DB")

contagens() {
  # Uma linha por tabela critica: "tabela=total".
  "${RUNNER[@]}" psql --host="$DB_TARGET_HOST" --port="$PORT" --username="$POSTGRES_USER" \
    --dbname="$1" --tuples-only --no-align --quiet \
    -c "SELECT 'members_member=' || count(*) FROM members_member
        UNION ALL SELECT 'finance_contribution=' || count(*) FROM finance_contribution
        UNION ALL SELECT 'finance_contributionattachment=' || count(*) FROM finance_contributionattachment
        UNION ALL SELECT 'accounts_user=' || count(*) FROM accounts_user
        ORDER BY 1;"
}

echo "[restore] $(date -Iseconds) recriando banco '$TARGET_DB' em $DB_TARGET_HOST:$PORT (PGSSLMODE=$PGSSLMODE)"
"${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
"${PSQL[@]}" -c "CREATE DATABASE \"$TARGET_DB\" OWNER \"$POSTGRES_USER\";"

echo "[restore] restaurando $DUMP_FILE"
# O dump entra por stdin: funciona igual com pg_restore no host ou no container.
"${RUNNER[@]}" pg_restore \
  --host="$DB_TARGET_HOST" \
  --port="$PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$TARGET_DB" \
  --no-owner \
  --exit-on-error \
  < "$DUMP_FILE"

# --- Conferencia -------------------------------------------------------------
echo "[restore] contagens no banco restaurado:"
"${PSQL_DEST[@]}" --tuples-only --no-align --quiet \
  -c "SELECT '  ' || t || ': ' || c FROM (
        SELECT 'members_member' AS t, count(*) AS c FROM members_member
        UNION ALL SELECT 'finance_contribution', count(*) FROM finance_contribution
        UNION ALL SELECT 'finance_contributionattachment', count(*) FROM finance_contributionattachment
        UNION ALL SELECT 'accounts_user', count(*) FROM accounts_user) AS x
      ORDER BY 1;"

# Comparacao origem x destino: o backup so e bom se os numeros baterem.
if [[ "${COMPARE_SOURCE:-yes}" == "yes" ]]; then
  ORIGEM="$(contagens "$POSTGRES_DB" | tr -d '\r' | sort)"
  DESTINO="$(contagens "$TARGET_DB" | tr -d '\r' | sort)"
  if [[ "$ORIGEM" != "$DESTINO" ]]; then
    echo "[restore] origem:" >&2
    echo "$ORIGEM" | sed 's/^/  /' >&2
    echo "[restore] destino:" >&2
    echo "$DESTINO" | sed 's/^/  /' >&2
    avisar "contagens divergem entre origem e destino; backup NAO confere"
    exit 1
  fi
  echo "[restore] contagens conferem com o banco de origem"
fi

echo "[restore] concluido: $TARGET_DB (o banco de origem nao foi tocado)"
