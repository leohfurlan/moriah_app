# Runbook — deploy e rollback do piloto

> Para o host compartilhado `atos-pd`, seguir primeiro o
> [plano KingHost de 08/10/2026](plano-implantacao-kinghost-2026-10-08.md).
> O proxy existente ocupa 80/443; não ativar outro proxy nem aplicar cloud-init.

**Escopo:** stack de `docker-compose.pilot.yml` (gunicorn + whitenoise, banco
gerenciado no Neon, comprovantes em S3/R2). Adaptação local = Fase 1 do
`docs/architecture/plano-arquitetura-oracle-neon-piloto.md`.

**Regras que não mudam:**

- a imagem é a unidade de deploy — não há volume de código; rollback = voltar a
  uma tag anterior;
- migração nunca roda sozinha no `up`: quem migra é o serviço `migrate`
  (perfil `tools`), de propósito;
- nada de `runserver` fora da máquina de desenvolvimento;
- o backend escuta em `127.0.0.1`; quem fala com a internet é o proxy
  (`deploy/Caddyfile`).

---

## 0. Preparar o ambiente (uma vez por host)

```bash
git clone <repo> moriah_app && cd moriah_app
cp .env.example .env.pilot     # preencher com os valores do piloto
chmod 600 .env.pilot           # o arquivo tem segredo de assinatura e senha do banco
docker compose -f docker-compose.pilot.yml --env-file .env.pilot build
```

O que precisa estar correto no `.env.pilot` (detalhes em `docs/ambiente-piloto.md`):

| Variável | Valor no piloto |
| --- | --- |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | 64 caracteres aleatórios (nunca o valor de dev) |
| `DJANGO_ALLOWED_HOSTS` | domínio do piloto (sem `*`) |
| `POSTGRES_HOST` | host do Neon |
| `POSTGRES_SSLMODE` | `require` (o `check --deploy` recusa host remoto sem TLS) |
| `POSTGRES_CONN_MAX_AGE` | `60` (o Neon fecha conexão ociosa; ver §4) |
| `USE_S3_STORAGE` | `true` com bucket privado e URL assinada |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | domínio do app em `https://` |

---

## 1. Deploy

```bash
export REV=$(git rev-parse --short HEAD)          # revisao que vai ao ar
export APP_REVISION=$REV                          # entra na tag da imagem e em /health/

# 1. construir a imagem da revisao
docker compose -f docker-compose.pilot.yml --env-file .env.pilot build

# 2. conferir as guardas de configuracao ANTES de tocar no banco
docker run --rm --env-file .env.pilot moriah-backend:$REV python manage.py check --deploy

# 3. migrar (explicito)
docker compose -f docker-compose.pilot.yml --env-file .env.pilot --profile tools run --rm migrate

# 4. subir a aplicacao
docker compose -f docker-compose.pilot.yml --env-file .env.pilot up -d backend
```

O passo 2 é o mesmo `check --deploy` que o CI roda no job
`guardas-de-deploy`: se ele falhar, **pare** — a configuração do ambiente está
incompleta (segredo de exemplo, host curinga, banco remoto sem TLS).

## 2. Verificar o deploy

```bash
curl -fsS http://127.0.0.1:8000/health/          # {"status":"ok","revision":"<REV>"}
curl -fsS http://127.0.0.1:8000/health/ready/    # {"status":"ready","database":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/static/admin/css/base.css   # 200

docker compose -f docker-compose.pilot.yml --env-file .env.pilot ps      # backend (healthy)
docker compose -f docker-compose.pilot.yml --env-file .env.pilot logs --tail 50 backend
```

- `/health/` é o *liveness* (não toca no banco) — alvo recomendado para o healthcheck.
- `/health/ready/` é o *readiness*: devolve **503** se o banco não responde, e
  é o alvo atual do Compose. Falha marca o container como `unhealthy`, mas
  não o reinicia automaticamente. Antes do piloto Neon, trocar o polling
  periódico para liveness para não manter o banco ativo por consultas de saúde.
- `revision` em `/health/` diz qual commit está no ar: é a primeira coisa a
  olhar quando algo parece errado.

Depois, pelo proxy: login no app, abrir extrato e uma contribuição (leitura de
dados reais) antes de liberar para o grupo do piloto.

## 3. Rollback

### Aplicação (minutos)

```bash
export APP_REVISION=<revisao-que-funcionava>
docker compose -f docker-compose.pilot.yml --env-file .env.pilot up -d backend
curl -fsS http://127.0.0.1:8000/health/     # confirma a revisao de volta
```

Se a imagem antiga ainda existe localmente, o `up -d` apenas troca o container;
se não existe, o compose usa a tag anterior (build a partir do commit antigo se
necessário: `git checkout <commit> && docker compose ... build`).

### Banco

**Não desfazer migração automaticamente.** O piloto segue o padrão
expandir → implantar → migrar dados → remover:

1. a migração nova é aditiva (coluna/tabela nova, sem `DROP`);
2. o código antigo continua rodando com o schema novo;
3. o rollback da aplicação não toca no banco;
4. remoção de estrutura antiga só depois de a versão nova estar estável.

Migração destrutiva no piloto exige: backup verificado (§`runbook-backup-restore.md`)
+ aprovação explícita — e o ensaio de restauração feito antes.

## 4. Notas de operação

- **Conexões:** cada worker do gunicorn mantém `POSTGRES_CONN_MAX_AGE` segundos
  de conexão viva. Com 3 workers o consumo é pequeno, mas se o Neon reclamar do
  limite, reduza `GUNICORN_WORKERS` antes de mexer no banco.
- **Estatícos:** são servidos pelo whitenoise direto do container. Se o piloto
  ganhar CDN/proxy para `/static/`, desligue `WHITENOISE_MAX_AGE` (ou ajuste)
  para não servir CSS antigo depois de um deploy.
- **Migração explícita:** em restart/reboot o container **não** migra; se a
  revisão nova exige schema novo, o deploy precisa do passo 3 do §1.
- **Manutenção curta:** com uma réplica e porta fixa, `compose up -d backend`
  pode interromper atendimento. Reservar janela; zero downtime exige uma
  estratégia adicional, implementada e ensaiada.

## 5. Checklist de deploy

- [ ] `.env.pilot` revisado (sem valor de dev, `DEBUG=false`, TLS no banco);
- [ ] `check --deploy` limpo na revisão que vai ao ar;
- [ ] backup do banco feito **e verificado** nas últimas 24 h;
- [ ] `migrate` aplicado com sucesso (saída sem erro);
- [ ] `/health/` com a revisão correta e `/health/ready/` com `database: ok`;
- [ ] login + extrato conferidos pelo proxy;
- [ ] logs sem exceção nos primeiros 5 minutos;
- [ ] rollback ensaiado (tag anterior conhecida, a mão).
