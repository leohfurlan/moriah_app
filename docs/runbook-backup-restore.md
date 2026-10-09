# Runbook — backup e restauração do Postgres

**Escopo:** `scripts/backup_postgres.sh` e `scripts/restore_postgres.sh`.
Cobre o banco de desenvolvimento (container) e o banco gerenciado do piloto
(Neon), com TLS obrigatório em host remoto.

**Por que existe:** um backup que nunca foi restaurado não é um backup — é uma
esperança. Este runbook termina com o ensaio de restauração que produz a
evidência exigida antes do piloto (Fase 5 do
`docs/architecture/plano-arquitetura-oracle-neon-piloto.md`).

---

## 1. Backup

```bash
./scripts/backup_postgres.sh                          # usa o .env da raiz
BACKUP_DIR=/var/backups/moriah ./scripts/backup_postgres.sh
BACKUP_HEALTH_FILE=/var/backups/moriah/ok.txt ./scripts/backup_postgres.sh
```

O que o script faz, em ordem, e por quê:

| Passo | Garantia |
| --- | --- |
| Lê `POSTGRES_*` do `.env` (variáveis do ambiente vencem o arquivo) | uma única cópia das credenciais |
| Exige `POSTGRES_SSLMODE=require` quando o host é remoto | dump não sai em claro pela internet |
| `pg_dump --format=custom` direto para `arquivo.partial` | falha no meio não deixa backup truncado com nome bom |
| `pg_restore --list` no arquivo gerado | o dump é legível, não só existente |
| só então renomeia para `moriah-<data>.dump` e grava `ultimo-backup-ok.txt` | o carimbo de sucesso nunca mente |
| `find ... -mtime +N -delete` (retenção, `BACKUP_RETENTION_DAYS`, padrão 30) | disco não enche |
| `trap ERR` → mensagem + webhook (`BACKUP_ALERT_WEBHOOK`) + `exit != 0` | falha não passa em silêncio |

Agendamento (cron no host do piloto, diário às 02:00):

```cron
0 2 * * * cd /opt/moriah_app && ./scripts/backup_postgres.sh >> /var/log/moriah-backup.log 2>&1
```

**Vigia:** a falha mais perigosa não é o erro, é o backup que parou de rodar.
Um cron `no_agent` que avisa quando `ultimo-backup-ok.txt` tem mais de 26 h:

```bash
f=/var/backups/moriah/ultimo-backup-ok.txt
[ -f "$f" ] && [ -z "$(find "$f" -mmin +1560)" ] || echo "backup do Moriah parado ha mais de 26h"
```

### Alerta por webhook

`BACKUP_ALERT_WEBHOOK` aceita qualquer endpoint que receba `POST {"text": "..."}`
(Slack, Discord, n8n, Zabbix). Sem a variável, o alerta fica só no stderr/exit
code — que é o que o cron registra. O script **não** falha se o webhook estiver
fora do ar (avisa e segue).

---

## 2. Restauração — ensaio (rota normal)

Restaura **sempre** para um banco descartável (`<POSTGRES_DB>_restore_test`),
nunca por cima do banco de origem — o ensaio não pode destruir dados reais:

```bash
./scripts/restore_postgres.sh backups/moriah-20260924-122847.dump
```

O script recria o banco de destino, restaura com `--exit-on-error`, imprime as
contagens das tabelas críticas e **compara origem × destino** — se divergir,
falha com exit code != 0 (`COMPARE_SOURCE=no` para pular a comparação).

Saída do ensaio executado em 24/09/2026 (banco de dev, 176 KB):

```
[restore] psql/pg_restore nao encontrados no host; usando o container 'db'
[restore] 2026-09-24T12:28:58-03:00 recriando banco 'moriah_restore_test' em localhost:5432 (PGSSLMODE=prefer)
[restore] restaurando tmp/backups/moriah-20260924-122847.dump
[restore] contagens no banco restaurado:
  accounts_user: 14
  finance_contribution: 14
  finance_contributionattachment: 3
  members_member: 9
[restore] contagens conferem com o banco de origem
[restore] concluido: moriah_restore_test (o banco de origem nao foi tocado)
```

## 3. Restauração de emergência (por cima do banco real)

```bash
TARGET_DB=moriah ALLOW_PRODUCTION=yes ./scripts/restore_postgres.sh <arquivo.dump>
```

Sem `ALLOW_PRODUCTION=yes` o script **recusa** — restaurar sobre o banco de
origem apaga os dados atuais. Antes de rodar:

1. coloque a aplicação em manutenção (o pool de conexões vai cair);
2. guarde o dump do estado *atual* antes de sobrescrever (`./scripts/backup_postgres.sh`);
3. saiba que o banco volta ao ponto do dump: **tudo que entrou depois é perdido**;
4. depois de restaurar, rode `python manage.py migrate` (a imagem nova pode
   esperar coluna nova) e confira `/health/ready/` e o extrato no app.

## 4. Verificações que valem a pena

| O que | Como |
| --- | --- |
| Guarda de TLS em host remoto | `POSTGRES_HOST=ep-x.neon.tech POSTGRES_SSLMODE=prefer ./scripts/backup_postgres.sh` → recusa com exit 1 |
| Alerta de falha | `POSTGRES_DB=inexistente ./scripts/backup_postgres.sh` → "FALHA no backup (linha N: ...)", exit 1, sem `.partial` deixado para trás |
| Retenção | `BACKUP_RETENTION_DAYS=0 ./scripts/backup_postgres.sh` → informa quantos dumps removeu |
| Banco remoto sem cliente no host | mensagem explícita: o `pg_dump` do host precisa existir (o container do Compose só serve o banco local) |

Sem cliente Postgres no host (caso do Windows de desenvolvimento), os dois
scripts usam o container do serviço `db` automaticamente — inclusive passando a
senha por `-e PGPASSWORD` (sem valor no `argv`). **No host do piloto, instale o
cliente** (`postgresql-client-16`), porque o banco é o Neon e não há container
de banco para servir de ponte.

## 5. O que nunca fazer

- versionar dump: contém dados pessoais e financeiros (`.gitignore` cobre
  `backups/` e `*.dump`);
- restaurar sobre o banco de origem sem `ALLOW_PRODUCTION=yes` e sem backup do
  estado atual;
- rodar `pg_dump`/`pg_restore` de versão **menor** que a do servidor;
- confiar em backup que não passou pelo ensaio deste runbook.
