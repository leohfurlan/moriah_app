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

## Observacoes de implementacao

- Uploads usam armazenamento local em `backend/media/`.
- A camada atual esta pronta para trocar `FileField` para storage S3 no futuro.
- A validacao de contribuicoes fica no Django Admin nesta primeira entrega.
- O app mobile foi mantido simples e funcional, priorizando o fluxo real do MVP.

## Seeds e migrations

Se quiser rodar fora do Docker:

```bash
cd backend
python manage.py migrate
python manage.py seed_mvp
python manage.py runserver
```

## Proximos passos naturais

- Padronizar refresh automatico de token no app
- Adicionar testes de API e permissoes
- Evoluir o app para navegacao com tabs e estados globais
- Trocar storage local por S3 em homologacao/producao
