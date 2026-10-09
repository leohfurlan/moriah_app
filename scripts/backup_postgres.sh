#!/usr/bin/env bash
#
# Backup do banco Postgres do Moriah App.
#
# Gera um dump no formato custom (-Fc), que permite restauracao seletiva e
# paralela, valida o arquivo, remove backups mais antigos que a retencao e
# avisa (webhook opcional) quando falha — um backup que falha em silencio e
# pior do que nao ter backup.
#
# Uso:
#   ./scripts/backup_postgres.sh                    # usa .env da raiz do repo
#   BACKUP_DIR=/var/backups/moriah ./scripts/backup_postgres.sh
#
# Banco remoto (piloto no Neon): o .env precisa ter POSTGRES_SSLMODE=require;
# o script recusa conectar sem TLS em host remoto.
#
# Agendamento (cron, diario as 02:00):
#   0 2 * * * cd /opt/moriah_app && ./scripts/backup_postgres.sh >> /var/log/moriah-backup.log 2>&1

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"

# Variaveis ja exportadas no ambiente vencem o .env: sem isso nao daria para
# apontar o script para outro banco (ex.: conferir a guarda de TLS) sem editar
# arquivo.
_externas=""
for _v in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_HOST POSTGRES_PORT POSTGRES_SSLMODE BACKUP_DIR BACKUP_ALERT_WEBHOOK BACKUP_HEALTH_FILE; do
  if [[ -n "${!_v+set}" ]]; then
    _externas+="export $_v=$(printf '%q' "${!_v}")"$'\n'
  fi
done

# Carrega as credenciais do mesmo .env usado pela aplicacao, para nao manter
# uma segunda copia da senha do banco.
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
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
# Arquivo com o carimbo do ultimo backup bom: serve para um vigia (cron/monitor)
# detectar "o backup parou de rodar", que e a falha mais perigosa.
HEALTH_FILE="${BACKUP_HEALTH_FILE:-$BACKUP_DIR/ultimo-backup-ok.txt}"

avisar() {
  echo "[backup] $(date -Iseconds) $1" >&2
  if [[ -n "${BACKUP_ALERT_WEBHOOK:-}" ]]; then
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      --data "{\"text\":\"[backup][moriah] $1 (host $(hostname))\"}" \
      "$BACKUP_ALERT_WEBHOOK" > /dev/null 2>&1 \
      || echo "[backup] aviso: webhook de alerta nao pode ser chamado" >&2
  fi
}

# Um dump interrompido nao pode ficar no lugar de um backup valido.
limpar_parcial() {
  if [[ -n "${TARGET:-}" && -f "${TARGET}.partial" ]]; then
    rm -f "${TARGET}.partial"
  fi
  return 0
}

# Qualquer erro nao tratado (pg_dump, disco cheio, pg_restore --list) cai aqui.
trap 'limpar_parcial; avisar "FALHA no backup (linha $LINENO: $BASH_COMMAND)"' ERR

# --- TLS ---------------------------------------------------------------------
# Postgres gerenciado (Neon) exige TLS: sem sslmode explicito o dump poderia
# sair em claro pela rede. Fail-closed apenas para host remoto, para nao
# atrapalhar o banco de dev no docker-compose.
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

# Se o banco roda no docker-compose, o host "db" so resolve dentro da rede do
# Compose. Rodando o script no host, use localhost.
if [[ "$POSTGRES_HOST" == "db" && -z "${FORCE_DB_HOST:-}" ]]; then
  POSTGRES_HOST="localhost"
fi

mkdir -p "$BACKUP_DIR"

# --- Cliente -----------------------------------------------------------------
# O pg_dump precisa ser de versao >= a do servidor. Se existir no host, usa o
# do host; senao, usa o container do servico db (apenas no cenario local, onde
# o banco tambem esta no Compose).
DB_SERVICE="${DB_SERVICE:-db}"
export PGPASSWORD="${POSTGRES_PASSWORD:-moriah}"
# Em modo container o -e sem valor repassa a senha do host para o exec, sem
# deixar a senha no argv do processo.
PGPASS_ARG=(-e PGPASSWORD)
if command -v pg_dump > /dev/null 2>&1; then
  RUNNER=()
  DB_TARGET_HOST="$POSTGRES_HOST"
elif [[ "$DB_LOCAL" == "sim" ]] && docker compose --project-directory "$REPO_DIR" ps "$DB_SERVICE" > /dev/null 2>&1; then
  echo "[backup] pg_dump nao encontrado no host; usando o container '$DB_SERVICE'"
  RUNNER=(docker compose --project-directory "$REPO_DIR" exec -T "${PGPASS_ARG[@]}" "$DB_SERVICE")
  DB_TARGET_HOST="localhost"
else
  avisar "pg_dump nao encontrado no host e o banco '$POSTGRES_HOST' nao esta no Compose"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/moriah-$STAMP.dump"

echo "[backup] $(date -Iseconds) iniciando dump de '$POSTGRES_DB' em $DB_TARGET_HOST:$POSTGRES_PORT (PGSSLMODE=$PGSSLMODE)"

# --format=custom: comprimido e restauravel com pg_restore.
# O dump vai por stdout e o redirecionamento e feito aqui no host: assim o
# mesmo codigo funciona com pg_dump no host ou dentro do container (onde o
# caminho do host nao existe).
# Escreve primeiro em .partial para que uma falha no meio nunca deixe um
# arquivo truncado com nome de backup valido.
"${RUNNER[@]}" pg_dump \
  --host="$DB_TARGET_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  > "$TARGET.partial"

mv "$TARGET.partial" "$TARGET"

# Verificacao de integridade: se o dump nao pode ser lido, o backup nao vale.
if ! "${RUNNER[@]}" pg_restore --list < "$TARGET" > /dev/null 2>&1; then
  avisar "dump gerado nao pode ser lido por pg_restore: $TARGET"
  exit 1
fi

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "[backup] concluido: $TARGET ($SIZE)"

# Carimbo de sucesso: escrito apenas depois de o dump ser validado.
printf '%s\n' "$(date -Iseconds) $TARGET $SIZE" > "$HEALTH_FILE"

# Retencao: remove dumps antigos apenas apos o novo ter sido validado acima.
DELETED="$(find "$BACKUP_DIR" -name 'moriah-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
echo "[backup] retencao de $RETENTION_DAYS dias aplicada ($DELETED arquivo(s) removido(s))"

# Restam quantos backups?
REMAINING="$(find "$BACKUP_DIR" -name 'moriah-*.dump' -type f | wc -l)"
echo "[backup] $REMAINING backup(s) disponivel(is) em $BACKUP_DIR"
