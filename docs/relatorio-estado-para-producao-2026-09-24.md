# Estado do código e caminho para produção — App Moriah

**Data da auditoria:** 24/09/2026
**Branch:** `codex/finance-contribution-ledger`
**Merge de `origin/master` aplicado:** `15ce4ab` (pais `9dc9d31` + `4219d40`)
**Como foi feito:** inspeção direta do repositório nesta data — `git`, `pytest`
(SQLite e PostgreSQL), `tsc`, `docker` e o próprio verificador QA. Os relatórios
de 16/09 e 17/09 descrevem um estado que **não é mais** o do working tree; este
substitui a leitura de "onde estamos".

---

## 1. O que foi feito nesta sessão

1. **Preservado o trabalho que só existia na árvore de trabalho** — commit
   `9dc9d31` (auditoria, plano Oracle/Neon, docs da fase 6, testes de conteúdo e
   de diretório, 9 rotas novas, ajustes em telas). Evidências de QA
   (`docs/qa/evidencias/`, 13 MB) ficaram de fora: são regeneráveis e já são
   ignoradas em `origin/master`.
2. **Merge de `origin/master` no branch** — 15 conflitos, todos resolvidos
   (§3), com a decisão registrada no commit `15ce4ab`.
3. **Migration de merge criada** — `finance/0004_merge_20260924_0952.py`. O
   branch tinha `0002_contribution_review_notes` e `0003_contribution_financial_link`
   como duas folhas do grafo (erro `Conflicting migrations detected`).
4. **Correções de integração que o merge automático não resolveu**
   (achadas por `tsc`/`pytest`, não por inspeção visual): import faltante de
   `ensure_contribution_financial_entry`, permissão de revisão de contribuição,
   chaves `patch`/`delete` duplicadas em `mobile/src/services/api.ts`,
   `Screen.tsx` apontando para `MVP_NOTIFICATIONS` (símbolo que o `origin/master`
   removeu) e `MEMBER_PATHS`/`ROTAS_DE_GESTAO` desalinhados com as telas novas.
5. **Teste do evento corrigido** — `backend/apps/events/tests/test_event_api.py`
   usava `start_at` fixo em 20/09/2026; a agenda filtra
   `start_at >= agora - 1 dia` e o teste vencia sozinho. Passou a usar data
   relativa.

---

## 2. Estado verificado

### 2.1 Git

| Item | Situação |
| --- | --- |
| HEAD | `15ce4ab` (merge), árvore limpa |
| Branches locais | `master`, `codex/fase-3-gestao-financeira`, `codex/fase-4-correcoes`, `codex/fase-5-escalas`, `codex/moriah-navigation-admin`, `codex/finance-contribution-ledger` (atual) |
| `origin/master` | contido em HEAD (merge feito) |
| Stashes | 2 — `stash@{0}` "codex preserve pre-branch work"; `stash@{1}` "fase-3 parcial truncado" |
| Diferença do branch para `origin/master` | 66 arquivos (app `content`, anúncios de evento, livro financeiro `FinancialEntry`, docs, PRD, telas novas) |

### 2.2 Backend

- Apps: `accounts`, `audit`, `cells`, `content`, `events`, `finance`, `members`,
  `ministries`, `schedules`.
- Migrations: sem folhas duplicadas após o merge de migration.
- CI (`.github/workflows/ci.yml`) tem 3 jobs: `Backend (pytest)` +
  validação do schema (`spectacular`) + `manage.py check`; `Mobile (typecheck e
  regressões)`; e `finance-postgres` (serviço `postgres:16`, roda
  `apps/finance/tests apps/schedules/tests apps/audit/tests` com
  `--ds=config.settings_test_postgres`).
- Segurança de produção já parametrizada por env (`config/settings.py`):
  `DEBUG`, `ALLOWED_HOSTS`, HSTS/cookies secure/SSL redirect quando
  `DEBUG=false`, JWT 60 min / 7 dias, storage S3/R2 opcional para comprovantes
  (`USE_S3_STORAGE`), `scripts/backup_postgres.sh` com retenção.
- **Lacuna de runtime:** `backend/requirements.txt` não tem `gunicorn`/`uvicorn`
  e o `Dockerfile` sobe `python manage.py runserver`. Não há `whitenoise` —
  estáticos dependem de proxy (Caddy/Nginx) em produção.

### 2.3 App (Expo/React Native web)

- Telas reais: `content`, `events`, `members`, `visitors`, `finance`,
  `finance-management`, `finance-review`, `schedule-admin`, `schedule-create`,
  `agenda-new`, `statement`, `contribution`, `schedules`, `profile`, `home`.
- **Placeholders** (`ModulePlaceholderScreen`, sem conteúdo de produto):
  `ministries`, `setlists`, `repertoire`, `bands`, `bible-school`, `classes`.
  Ficaram **fora do menu lateral** de propósito (§5.2).
- Navegação: `mobile/src/navigation.ts` é a fonte única (item declara rota,
  capacidade exigida e rotas que o mantêm ativo); o menu filtra por capacidade.
- Rótulos e tokens em `mobile/src/theme.ts` (accent `#4F46E5`, canvas `#F6F7FB`,
  ink `#101828`), espelhando `design/moriah_next.pen`.

### 2.4 Aceite (QA)

`node tools/qa/run.mjs fase1|fase2|fase3|fase4|fase5|todas` — precisa do app em
`http://localhost:8081` e, nas fases 1/2/4, do backend em `:8000`. Relatórios
versionados em `docs/qa/fase-*.md`; evidências (ignoradas pelo Git) em
`docs/qa/evidencias/`.

---

## 3. Resolução dos 15 conflitos

| Arquivo | Decisão |
| --- | --- |
| `accounts/permissions.py` | União: `manage_finance`, `manage_content`, `manage_events` (branch) **+** `manage_schedules` com a regra `IsScheduleCoordinatorOrAdmin` (origin/master) |
| `events/views.py` | União: `OptionalPaginationMixin` e filtros (`event_type`, `q`, `date_from/date_to`) do origin/master **+** `EventAnnouncementViewSet` do branch |
| `finance/views.py` | Revisão de contribuição = versão do origin/master (409 ao mudar decisão final, `review_notes`, histórico, notificação ao membro) **com** a chamada a `ensure_contribution_financial_entry` no aceite, preservando o livro financeiro do branch (`FinancialEntryViewSet` mantido) |
| `finance/serializers.py` | Mantido o `FinancialEntrySerializer` do branch |
| `finance/tests/test_contribution_review.py` | União: testes do branch (idempotência do lançamento) + testes do origin/master (histórico, auditoria, filtros) — 15 testes, sem nome repetido |
| `members/views.py` | União: `IsMemberDirectoryUser` do branch + `MemberLinkRequest`/`MyMemberLinkRequestView` do origin/master |
| `config/urls.py` | União: rotas do branch (`finance/entries`, `content`, `members`) + aliases `local-api`/`backend` e `ministries`/`notifications` do origin/master |
| `mobile/src/theme.ts` | União dos rótulos, com os acentos do origin/master (`Contribuição`) |
| `mobile/src/components/Screen.tsx` | Versão do origin/master (item de menu com capacidade, busca, notificações reais) |
| `mobile/app/_layout.tsx` | `MEMBER_PATHS` do branch + `/agenda-new`; depois reajustado (§4) |
| `mobile/src/screens/ContentScreen.tsx` | Versão do branch (tela completa com markdown e editor) |
| `mobile/app/content.tsx` | Versão do origin/master (só formatação diferia) |
| `HomeScreen.tsx`, `StatementScreen.tsx`, `AgendaScreen.tsx` | Versões do branch |

**Permissão de revisão de contribuição:** ficou `IsFinancialManager`
(ADMIN/PASTOR/TREASURER) e não `IsTreasurerOrAdmin` (ADMIN/TREASURER) do
origin/master. Motivo: o teste do próprio branch
(`apps/finance/tests/test_financial_entries.py::test_gestor_visualiza_contribuicoes_da_igreja_para_aceite`)
exige que pastor liste contribuições para aceite, e o modelo de capacidades do
branch dá `manage_finance` a ADMIN/PASTOR/TREASURER. **É uma decisão de
segurança, não um detalhe de merge — revisar.**

---

## 4. O que o `origin/master` trazia e **não** foi carregado

Registrado aqui para reaplicação deliberada, não por esquecimento:

1. **`HomeScreen` do origin/master** — editor de "acessos rápidos"
   (`AsyncStorage`), helpers de honestidade de dados (`futuros`, `rotuloDia`) e
   `ErrorNotice` com retry. A versão do branch tem o carrossel de avisos
   (`/event-announcements/` + `/content/`).
2. **`StatementScreen` do origin/master** — extrato paginado (`api.getPage` +
   `pageInfo`). A versão do branch tem o fluxo de aceite de contribuição na
   própria tela.
3. **`AgendaScreen` do origin/master** — guarda de admin sem vínculo de membro
   e filtro `entry.category === "Minha agenda"`. A versão do branch tem o
   detalhe do evento por deep-link.
4. **`Screen.tsx` do branch** — sidebar recolhível e grupos próprios; substituída
   pela implementação que consome `navigation.ts`.
5. **`MVP_NOTIFICATIONS`** — lista de notificações de demonstração, removida pelo
   origin/master em favor de `useNotifications` + `/me/notifications`. Não voltou.

---

## 5. Divergências que precisam de decisão (não são bug)

### 5.1 Duas implementações da fase 6 (conteúdo)

`bf2af12 feat: implement phase 6 content publishing` vive em
`codex/moriah-navigation-admin` e **não** está na história deste branch. Ela traz
uma app `content` mais simples, `tools/qa/checks/fase6.mjs` e
`docs/qa/fase-6-conteudo-mobile-2026-09-17.md`. O branch tem a sua própria app
`content` (com `test_content_api.py` e `EventAnnouncement`). **Escolher uma ou
combinar — hoje existem duas linhas de trabalho para o mesmo módulo.**

### 5.2 Telas placeholder

Seis rotas (`ministries`, `setlists`, `repertoire`, `bands`, `bible-school`,
`classes`) existem como tela vazia. O `navigation.ts` do origin/master diz
explicitamente que item sem tela não entra no menu — por isso ficaram fora.
Ou viram módulo de verdade, ou saem do app.

### 5.3 `can_access_management` desalinhado

A função inclui `manage_events` mas não `manage_finance` nem `manage_content`
(`apps/accounts/permissions.py`). Na prática não tranca ninguém (quem tem essas
capacidades tem outra que está na lista), mas é inconsistente.

### 5.4 Restos de trabalho antigo

- `stash@{0}` ("codex preserve pre-branch work") e `stash@{1}` ("fase-3 parcial
  truncado") — decidir se descartam.
- Branches `codex/fase-3-gestao-financeira` e `codex/fase-4-correcoes` já
  consolidadas em `origin/master`.
- `.codex-remote-attachments/` (anexos de sessão de agente) agora está no
  `.gitignore`.

---

## 6. Verificação executada (evidência)

| Comando | Resultado |
| --- | --- |
| `cd backend && python -m pytest -q` (SQLite de `config.settings_test`) | **149 passed** |
| `POSTGRES_HOST=localhost python -m pytest apps/finance/tests apps/schedules/tests apps/audit/tests -q --ds=config.settings_test_postgres` (mesmo recorte do job `finance-postgres` do CI) | **97 passed** |
| `cd mobile && npx tsc --noEmit` | limpo (0 erros) |
| `node --test tools/qa/tests/mobile-regressions.cjs` | **11/11** |
| `docker start moriah_app-db-1` + `moriah_app-backend-1` | backend no ar, `manage.py migrate` aplicou `finance.0004_merge_20260924_0952` **no Postgres real com dados existentes** |

**O que não foi verificado e por quê:**

- `node tools/qa/run.mjs` (aceite de navegador): o app está configurado com
  `EXPO_PUBLIC_API_URL=/backend` (`mobile/.env`), que depende do container
  `moriah-ngrok-proxy` (parado) para que app e API fiquem na mesma origem. Sem
  ele, as chamadas do app caem no próprio dev server do Expo, que responde
  `index.html` (HTTP 200 `text/html`) e a tela mostra "Erro no servidor". O app
  **compila e renderiza** (login carrega, sem erro de bundle). Para rodar o QA:
  suba o proxy ngrok, ou troque `mobile/.env` para
  `EXPO_PUBLIC_API_URL=http://192.168.24.6:8000/api` (linha já comentada no
  arquivo) e reinicie o Expo.
- Fases 3 e 5 do QA usam API simulada e poderiam rodar sem backend, mas não
  foram executadas nesta sessão.

**Ambiente deixado ligado:** `moriah_app-db-1` e `moriah_app-backend-1` estão
rodando (`moriah-ngrok-proxy` e `moriah_app-mobile-1` continuam parados).

---

## 7. Caminho para produção

Os dois planos do repositório continuam válidos como roteiro:
`docs/plano-mvp-moriah-execucao-2026-09-16.md` (fases 0–6 do MVP + trilha de
segurança e operação) e `docs/architecture/plano-arquitetura-oracle-neon-piloto.md`
(VPS Oracle + Postgres gerenciado no Neon; status: **proposto, não autoriza
provisionamento**).

### 7.1 Bloqueadores técnicos (não dependem de decisão de produto)

1. **Servidor de aplicação:** adicionar `gunicorn` (ou `uvicorn`) e trocar o
   `CMD` do `Dockerfile`; `runserver` não vai para produção.
2. **Estáticos e mídia:** servir `/static/` e `/media/` pelo proxy (Caddy/Nginx)
   ou adicionar `whitenoise`; comprovantes já têm seam S3/R2 (`USE_S3_STORAGE`).
3. **Backup/restauração:** `scripts/backup_postgres.sh` existe, mas nunca foi
   exercitado em restauração — a Fase 5 do plano Oracle exige o ensaio.
4. **Segredos:** `DJANGO_SECRET_KEY`, senha do Postgres, chaves S3 e domínios em
   `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` precisam ser
   valores de produção, não os do `.env` de dev.
5. **Aceite antes de publicar:** rodar `node tools/qa/run.mjs todas` com o app e
   a API no ar e anexar o relatório; hoje o último aceite registrado é de 16/09
   (fases 1 e 2) e 17/09 (fase 5), anterior a este merge.

### 7.2 Ordem sugerida

1. Fechar §5 (decisões): conteúdo da fase 6, placeholders, permissão de revisão.
2. `node tools/qa/run.mjs todas` com ngrok ou LAN + CI verde no GitHub.
3. Ensaio de backup/restauração do Postgres.
4. Fase 1 do plano Oracle (adaptação local do runtime: WSGI, estáticos, env de
   produção) e depois provisionamento — em ambiente separado, com dados de
   demonstração, antes de qualquer dado real de membro.
5. Piloto interno (Fase 6 do plano Oracle) com rollback definido.

### 7.3 Riscos que valem atenção

- **Dados pessoais e financeiros** já existem no modelo (membros, contribuições,
  comprovantes anexos). Antes de produção: política de retenção, acesso a mídia
  por URL assinada (já implementado via `S3_URL_EXPIRE_SECONDS`) e trilha de
  auditoria (existe em `apps/audit`).
- **Sem vínculo de membro** é um estado normal para quem opera o painel; as
  guardas de rota foram ajustadas nesta sessão para não trancar essas contas
  fora das telas de gestão.
- **Divergência de UI** entre o que o branch mantém e o que o `origin/master`
  havia evoluído (§4) — quanto mais tempo passa, mais caro reconciliar.

---

## 8. Próximo módulo: emissão fiscal (NFe/NFCe)

Fora do escopo do MVP atual e sem código no repositório. Quando começar, o
material de estudo está em `~/nfse_estudo` e o roteiro em
`brazilian-fiscal-documents`. Ponto de atenção: emissão fiscal exige CNPJ,
certificado digital e integração com prefeitura/SEFAZ — não é uma app Django
como as demais, e o desenho precisa nascer com idempotência e conciliação
(o livro `FinancialEntry` já é o lugar natural para o vínculo).
