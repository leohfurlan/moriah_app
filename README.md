# Moriah App MVP

MVP full-stack para gestao interna da Igreja Moriah, com backend em Django REST Framework, PostgreSQL, admin web via Django Admin e app mobile em React Native com Expo.

## O que esta pronto nesta entrega

- Monorepo com `backend/` e `mobile/`
- Backend Django com apps por dominio
- Autenticacao JWT com `djangorestframework-simplejwt`
- CORS e `.env` configurados
- Models iniciais para igreja, membros, celulas, ministerios, eventos, escalas, contribuicoes e auditoria
- Django Admin configurado para o fluxo operacional do MVP
- APIs do membro logado, extrato, contribuicao, escalas e lider de celula
- App Expo com login, perfil, extrato, nova contribuicao e minhas escalas
- Seed local para demonstrar o fluxo principal
- Trilha de auditoria automatica em contribuicao, membro e escala
- Validacao de comprovante por extensao, tamanho e assinatura do arquivo
- Permissoes de painel por papel (tesouraria, secretaria, coordenacao, pastoral)
- Suite de testes com pytest e CI no GitHub Actions
- Documentacao da API em `/api/docs/`
- Storage S3/R2 opcional para comprovantes e scripts de backup/restore
- App configurado para build de producao (icone, splash, EAS)

## Estrutura

```text
moriah_app/
├── backend/
├── mobile/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Fluxo MVP coberto

1. Admin cria ou edita membros, celulas, eventos e escalas no Django Admin.
2. Membro faz login no app mobile com JWT.
3. Membro visualiza sua escala.
4. Membro confirma ou recusa com justificativa.
5. Membro envia contribuicao com um ou mais comprovantes.
6. Tesouraria visualiza a contribuicao pendente no admin e aprova manualmente.
7. Membro consulta o extrato e ve a contribuicao aprovada.

## Como rodar

1. Copie `.env.example` para `.env`.
2. Suba os containers:

```bash
docker compose up --build
```

3. Acesse o admin em [http://localhost:8000/admin](http://localhost:8000/admin)
4. Inicie o app Expo pelo container `mobile` ou localmente dentro de `mobile/`.

## Credenciais seed

- Admin: `admin@moriah.app` / `admin123`
- Tesouraria: `tesouraria@moriah.app` / `tesouraria123`
- Membro: `membro@moriah.app` / `membro123`
- Lider de celula: `lider.celula@moriah.app` / `lider123`

## Endpoints principais

- `POST /api/auth/login/`
- `GET /api/me/`
- `GET /api/me/member/`
- `GET /api/me/statement/`
- `POST /api/contributions/`
- `GET /api/me/schedules/`
- `POST /api/me/schedules/<id>/action/`
- `GET /api/leader/cell-members/`
- `POST /api/cell-meetings/`
- `GET /api/schema/` e `GET /api/docs/` (documentacao interativa)

## Observacoes de implementacao

- Em dev os uploads ficam em `backend/media/`. Com `USE_S3_STORAGE=true` vao
  para S3 ou Cloudflare R2, com URLs assinadas e temporarias (comprovante nunca
  fica em link publico permanente).
- A validacao de contribuicoes fica no Django Admin nesta primeira entrega.
- Fora do modo debug o Django assume HTTPS: HSTS, cookies `secure` e redirect.
- O app mobile foi mantido simples e funcional, priorizando o fluxo real do MVP.

## Permissoes de painel

`is_staff` sozinho nao da acesso a nenhum modelo: sem grupos, tesouraria e
secretaria entram no admin e nao veem nada. O mapeamento papel -> grupo vive em
`backend/apps/accounts/roles.py` e e aplicado por:

```bash
python manage.py sync_role_permissions
```

O comando e idempotente, roda junto do `seed_mvp` e deve ser executado a cada
deploy que altere papeis.

## Testes

```bash
cd backend
python -m pytest -q
```

No mobile, `npm run typecheck`. O workflow `.github/workflows/ci.yml` roda os
dois a cada push e pull request.

## Backup do banco

```bash
./scripts/backup_postgres.sh                       # dump + retencao de 30 dias
./scripts/restore_postgres.sh backups/<arquivo>    # restaura em banco de teste
```

O backup usa `pg_dump --format=custom`, valida o arquivo gerado com
`pg_restore --list` antes de aplicar a retencao, e funciona tanto com Postgres
no host quanto no container do docker-compose. O restore aponta por padrao para
`<banco>_restore_test` — restaurar sobre o banco real exige `ALLOW_PRODUCTION=yes`.

Agendamento sugerido (cron diario as 02:00):

```cron
0 2 * * * cd /opt/moriah_app && ./scripts/backup_postgres.sh >> /var/log/moriah-backup.log 2>&1
```

## Build do app

```bash
cd mobile
npm run build:preview      # APK de distribuicao interna (piloto)
npm run build:production   # build de loja
```

Os perfis ficam em `mobile/eas.json`. Antes do primeiro build rode `eas init`
para vincular o projeto a conta Expo e ajuste `EXPO_PUBLIC_API_URL` de cada
perfil para o servidor correspondente.

## Seeds e migrations

Se quiser rodar fora do Docker:

```bash
cd backend
python manage.py migrate
python manage.py seed_mvp
python manage.py runserver
```

## Proximos passos naturais

- Rodar o piloto interno (Fase 6 do PRD) com dados reais controlados
- Executar o teste de restauracao do backup no servidor de producao
- Evoluir o app para navegacao com tabs e estados globais
- Substituir o icone provisorio por identidade visual definitiva
- Endpoint de validacao de contribuicao fora do admin, se a tesouraria pedir
