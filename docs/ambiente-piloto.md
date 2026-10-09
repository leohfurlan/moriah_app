# Ambiente do piloto — Neon, storage, domínio e saúde

**Escopo:** o que configurar para subir o piloto descrito em
`docs/architecture/plano-arquitetura-oracle-neon-piloto.md` (VPS + Neon + S3/R2).
Companheiros: `docs/runbook-deploy-piloto.md` (deploy/rollback) e
`docs/runbook-backup-restore.md` (backup/restauração).

**Regra geral:** o arquivo real é `.env.pilot` (ignorado pelo Git). O
`.env.example` mostra **todas** as chaves, sem segredo nenhum.

---

## 1. Banco — Neon (Postgres gerenciado)

1. Crie projeto e **branch exclusiva do piloto** (não use a branch de produção de
   outro projeto/ambiente).
2. Crie um role da aplicação com permissão apenas no banco do piloto.
3. Copie host, banco, usuário e senha para o `.env.pilot`:

```env
POSTGRES_DB=<banco>
POSTGRES_USER=<role da aplicacao>
POSTGRES_PASSWORD=<senha>
POSTGRES_HOST=ep-<id>.<regiao>.aws.neon.tech
POSTGRES_PORT=5432
POSTGRES_SSLMODE=require        # obrigatorio: sem isso `check --deploy` falha
POSTGRES_CONN_MAX_AGE=60        # reaproveita conexao entre requisicoes
POSTGRES_CONN_HEALTH_CHECKS=true
```

- **TLS não é opcional.** O `manage.py check --deploy` recusa host remoto sem
  `POSTGRES_SSLMODE=require` (`config.E003`). Em host *local* (`localhost`,
  `db`) o TLS é dispensado, porque é o banco de desenvolvimento no Compose.
- **Pooled vs. direto:** o endpoint `-pooler` do Neon multiplexa as conexões no
  PgBouncer. O Django não usa *prepared statements* de sessão por padrão, então o
  pooled funciona; se aparecer erro de *prepared statement*, use o endpoint
  direto para a aplicação e o pooled só para ferramentas.
- **`CONN_MAX_AGE` alto + Neon suspenso:** o Neon suspende o compute ocioso e
  derruba conexões antigas. O `CONN_HEALTH_CHECKS=true` faz o Django testar a
  conexão antes de reusar, trocando "erro na primeira requisição" por uma
  reconexão transparente. Se ainda aparecer `OperationalError: server closed the
  connection`, reduza `CONN_MAX_AGE` para `0`.
- **Porta 5432 nunca aberta:** o Neon é acessado por saída HTTPS/TLS da VPS; não
  há firewall liberando Postgres.

## 2. Comprovantes — S3 ou Cloudflare R2

```env
USE_S3_STORAGE=true
S3_BUCKET_NAME=moriah-piloto-comprovantes
S3_ACCESS_KEY_ID=<chave>
S3_SECRET_ACCESS_KEY=<segredo>
S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com   # vazio para AWS S3
S3_REGION_NAME=auto                                           # sa-east-1 na AWS
S3_URL_EXPIRE_SECONDS=900
```

- O bucket é **privado**. O app e o painel nunca recebem URL pública: o backend
  devolve URL assinada com validade de `S3_URL_EXPIRE_SECONDS`.
- Sem `USE_S3_STORAGE`, os comprovantes ficam em `backend/media/`, que é o disco
  do container — **efêmero**: um `docker compose down` apaga comprovante de
  contribuição. Em piloto, ligue o storage.
- Verificação: suba um comprovante pelo app, confirme o objeto no bucket e
  confira que a URL colada no navegador **expira** (assinatura).

## 3. Domínio, TLS e cabeçalhos

```env
DJANGO_ALLOWED_HOSTS=piloto.moriah.app
CORS_ALLOWED_ORIGINS=https://piloto.moriah.app
CSRF_TRUSTED_ORIGINS=https://piloto.moriah.app
DJANGO_TRUST_PROXY_SSL_HEADER=true
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_HSTS_SECONDS=31536000
```

- Nada de `*` em `DJANGO_ALLOWED_HOSTS` (o `check --deploy` reprova com
  `config.E002`).
- As origens **precisam** ser `https://` em piloto: origem `http://` gera aviso
  `config.W007`, porque o cookie de sessão/CSRF não vira `secure`.
- O TLS termina no proxy (`deploy/Caddyfile`, perfil `proxy` do compose). Com
  proxy na frente, `DJANGO_TRUST_PROXY_SSL_HEADER=true` faz o Django gerar URLs
  absolutas em `https`.
- O gunicorn publica apenas `127.0.0.1:8000` (`PILOT_BIND`); quem fala com a
  internet é o proxy.

## 4. Runtime

| Chave | Padrão | Para que serve |
| --- | --- | --- |
| `APP_REVISION` | `unknown` | revisão que aparece em `/health/`; o CI passa o commit |
| `GUNICORN_WORKERS` | `3` | processos; 1 por núcleo é um bom começo em VPS pequena |
| `GUNICORN_THREADS` | `2` | threads por worker (I/O de banco e storage) |
| `GUNICORN_TIMEOUT` | `60` | segundos antes de o worker ser morto |
| `PILOT_BIND` / `PILOT_PORT` | `127.0.0.1` / `8000` | interface publicada no host |
| `DJANGO_LOG_LEVEL` | `INFO` | nível do log da aplicação (stdout) |
| `DJANGO_DB_LOG_LEVEL` | `WARNING` | nível das consultas SQL (não use `DEBUG`: vaza dado) |

A imagem de produção (`backend/Dockerfile.prod`) roda como usuário sem
privilégio (`uid 10001`), coleta os estáticos na build e sobe o gunicorn — trocar
`GUNICORN_*` não exige rebuild.

- Estáticos: servidos pelo whitenoise a partir da imagem. O cache usa
  `WHITENOISE_MAX_AGE` derivado de `DJANGO_DEBUG` (0 em dev, 1 h em produção).
  **Decisão de 24/09/2026:** sem CDN/proxy para `/static/` no piloto.

## 5. Saúde e observabilidade mínima

| Endpoint | O que responde | Uso |
| --- | --- | --- |
| `/health/` | `{"status":"ok","revision":"<commit>"}` — **não** toca no banco | liveness, checagem de "qual revisão está no ar" |
| `/health/ready/` | `{"status":"ready","database":"ok",...}`; **503** se o banco não responde | healthcheck do container, monitor de fora |

- Os dois ficam **isentos** do redirect HTTPS (`SECURE_REDIRECT_EXEMPT`), senão o
  healthcheck interno receberia 301 e nunca ficaria saudável. Continuam sendo
  endpoints públicos que não vazam configuração: só status, revisão e o estado
  do banco.
- Logs: o container usa `json-file` com rotação (10 MB × 5 arquivos). Coleta
  mínima: `docker compose logs backend` + `BACKUP_ALERT_WEBHOOK` do backup.
- Antes de subir, rode `python manage.py check --deploy` (é o que o CI faz no job
  `guardas-de-deploy`). Hoje ele passa com **0 erros** e apenas avisos de
  `drf_spectacular` (colisão de nome de enum do schema OpenAPI).

## 6. Checklist de go-live

- [ ] `.env.pilot` com segredo de 64 caracteres, senha de banco e chaves S3 reais;
- [ ] `POSTGRES_SSLMODE=require` e banco remoto respondendo (`/health/ready/`);
- [ ] bucket privado criado e um comprovante real subido + URL assinada expirando;
- [ ] domínio apontando para o proxy, certificado emitido, `https://` nas origens;
- [ ] `check --deploy` limpo na revisão que vai ao ar;
- [ ] backup diário agendado **e** vigia do carimbo `ultimo-backup-ok.txt`;
- [ ] ensaio de restauração feito (`docs/runbook-backup-restore.md` §2);
- [ ] rollback conhecido de cor (tag anterior da imagem);
- [ ] dados de teste aprovados carregados — nada de base real de membro antes do
      aceite do produto.

## 7. O que o piloto **não** tem (escopo declarado)

- sem alta disponibilidade: um host, um container de aplicação; se a VPS cair, o
  piloto fica fora até o restart;
- sem CDN para `/static/`: **decisão registrada em 24/09/2026** — o whitenoise
  serve do container, o que basta para um grupo pequeno. Reavaliar se o piloto
  crescer ou se os estáticos passarem de poucos MB por deploy (nesse caso,
  ajustar `WHITENOISE_MAX_AGE` e o cache do proxy).
- sem fila/worker assíncrono: o que é síncrono hoje continua síncrono;
- sem observabilidade de verdade (APM/tracing): logs + `/health/` + alerta de
  backup são o mínimo combinado para o piloto.
