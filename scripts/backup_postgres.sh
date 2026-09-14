#!/usr/bin/env bash
#
# Backup do banco Postgres do Moriah App.
#
# Gera um dump no formato custom (-Fc), que permite restauracao seletiva e
# paralela, e remove backups mais antigos que a retencao configurada.
#
# Uso:
#   ./scripts/backup_postgres.sh                    # usa .env da raiz do repo
#   BACKUP_DIR=/var/backups/moriah ./scripts/backup_postgres.sh
#
# Agendamento sugerido (cron, diario as 02:00):
#   0 2 * * * cd /opt/moriah_app && ./scripts/backup_postgres.sh >> /var/log/moriah-backup.log 2>&1

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"

# Carrega as credenciais do mesmo .env usado pela aplicacao, para nao manter
# uma segunda copia da senha do banco.
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
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Se o banco roda no docker-compose, o host "db" so resolve dentro da rede do
# Compose. Rodando o script no host, use localhost.
if [[ "$POSTGRES_HOST" == "db" && -z "${FORCE_DB_HOST:-}" ]]; then
  POSTGRES_HOST="localhost"
fi

mkdir -p "$BACKUP_DIR"

# O Postgres pode estar instalado no host ou rodando no docker-compose. Se o
# cliente nao existe no host, executamos as ferramentas dentro do container do
# servico de banco (nao ha necessidade de instalar Postgres no servidor).
DB_SERVICE="${DB_SERVICE:-db}"
if command -v pg_dump > /dev/null 2>&1; then
  RUNNER=(env "PGPASSWORD=${POSTGRES_PASSWORD:-moriah}")
  DB_TARGET_HOST="$POSTGRES_HOST"
elif docker compose --project-directory "$REPO_DIR" ps "$DB_SERVICE" > /dev/null 2>&1; then
  echo "[backup] pg_dump nao encontrado no host; usando o container '$DB_SERVICE'"
  RUNNER=(docker compose --project-directory "$REPO_DIR" exec -T           -e "PGPASSWORD=${POSTGRES_PASSWORD:-moriah}" "$DB_SERVICE")
  # Dentro do container, o banco responde em localhost.
  DB_TARGET_HOST="localhost"
else
  echo "[backup] ERRO: nem pg_dump no host nem o container '$DB_SERVICE' disponivel." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/moriah-$STAMP.dump"

echo "[backup] $(date -Iseconds) iniciando dump de '$POSTGRES_DB' em $POSTGRES_HOST:$POSTGRES_PORT"

export PGPASSWORD="${POSTGRES_PASSWORD:-moriah}"

# --format=custom: comprimido e restauravel com pg_restore.
# Escreve primeiro em .partial para que uma falha no meio nunca deixe um
# arquivo truncado com nome de backup valido.
pg_dump \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --file="$TARGET.partial"

mv "$TARGET.partial" "$TARGET"

# Verificacao de integridade: se o dump nao pode ser lido, o backup nao vale.
if ! pg_restore --list "$TARGET" > /dev/null 2>&1; then
  echo "[backup] ERRO: dump gerado nao pode ser lido por pg_restore: $TARGET" >&2
  exit 1
fi

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "[backup] concluido: $TARGET ($SIZE)"

# Retencao: remove dumps antigos apenas apos o novo ter sido validado acima.
DELETED="$(find "$BACKUP_DIR" -name 'moriah-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
echo "[backup] retencao de $RETENTION_DAYS dias aplicada ($DELETED arquivo(s) removido(s))"

# Restam quantos backups?
REMAINING="$(find "$BACKUP_DIR" -name 'moriah-*.dump' -type f | wc -l)"
echo "[backup] $REMAINING backup(s) disponivel(is) em $BACKUP_DIR"
