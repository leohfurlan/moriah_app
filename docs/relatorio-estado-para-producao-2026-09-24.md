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
| Diferença do branch para `origin/master` | 66 arquivos no commit do merge (`15ce4ab`); cresce a cada ajuste do branch (consultar `git diff --name-only 4219d40..HEAD`) |

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
| `HomeScreen.tsx`, `StatementScreen.tsx` | Versão do origin/master — a do branch exibia KPI/gráfico inventado e o aceite (fase 1 check 9, fase 5) reprovava (§6) |
| `AgendaScreen.tsx` | Versão do branch (deep-link do evento); a variante do origin/master tinha a guarda de admin sem vínculo |

**Permissão de revisão de contribuição:** ficou `IsFinancialManager`
(ADMIN/PASTOR/TREASURER) e não `IsTreasurerOrAdmin` (ADMIN/TREASURER) do
origin/master. Motivo: o teste do próprio branch
(`apps/finance/tests/test_financial_entries.py::test_gestor_visualiza_contribuicoes_da_igreja_para_aceite`)
exige que pastor liste contribuições para aceite, e o modelo de capacidades do
branch dá `manage_finance` a ADMIN/PASTOR/TREASURER. **É uma decisão de
segurança, não um detalhe de merge — revisar.**

---

## 4. O que o `origin/master` trazia e **não** foi carregado

Registrado aqui para reaplicação deliberada, não por esquecimento. (`HomeScreen` e
`StatementScreen` saíram desta lista: o aceite mostrou que as versões do
`origin/master` eram as que cumprem os critérios das fases 1 e 5 — ver §6.)

1. **`AgendaScreen` do origin/master** — guarda de admin sem vínculo de membro
   e filtro `entry.category === "Minha agenda"`. A versão do branch tem o
   detalhe do evento por deep-link, e é a que passa nas fases 1 e 5.
2. **`Screen.tsx` do branch** — sidebar recolhível e grupos próprios; substituída
   pela implementação que consome `navigation.ts`. As telas reais do branch
   entraram no menu por `navigation.ts` (Membros, Visitantes, Conteúdo, Cultos e
   eventos, Gestão financeira).
3. **`MVP_NOTIFICATIONS`** — lista de notificações de demonstração, removida pelo
   origin/master em favor de `useNotifications` + `/me/notifications`. Não voltou.
4. **Carrossel de avisos da Home do branch** (`/event-announcements/` +
   `/content/`): a tela de anúncios continua existindo e acessível pelo menu; só
   não é mais renderizada dentro da Home.


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

### 5.5 Revisão financeira no mobile (AVISO do aceite)

O critério "tesouraria sem vínculo acessa a revisão pelo mobile" não tem mais
caminho de menu: o `navigation.ts` do origin/master deixou "Revisão" fora das
abas do mobile (comentário do próprio arquivo: "Escalas e Revisão ficam dentro
dos módulos relacionados"). A tela responde em `/finance-review` e a guarda de
capacidade funciona (`review_contributions`), mas no celular a tesouraria só
chega por link direto. **Decidir:** devolver o item às abas do mobile, criar um
atalho a partir do extrato/contribuições, ou manter como está.

### 5.6 Restos de trabalho antigo

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
| `cd backend && python -m pytest -q` (SQLite de `config.settings_test`) | **157 passed** (149 do merge + testes de notificação e de permissão de compromisso) |
| `POSTGRES_HOST=localhost python -m pytest apps/finance/tests apps/schedules/tests apps/audit/tests -q --ds=config.settings_test_postgres` (mesmo recorte do job `finance-postgres` do CI) | **105 passed** |
| `cd mobile && npx tsc --noEmit` | limpo (0 erros) |
| `node --test tools/qa/tests/mobile-regressions.cjs` | **11/11** |
| `docker start moriah_app-db-1` + `moriah_app-backend-1` | backend no ar, `manage.py migrate` aplicou `finance.0004_merge_20260924_0952` **no Postgres real com dados existentes** |

**Verificação executada:** `node tools/qa/run.mjs todas` com
`QA_BASE=http://localhost:9000` (ver §6.1) — **fase1 20/20, fase2 14/14,
fase3 13/13 (1 AVISO), fase4 11/11, fase5 13/13**, todas com evidência em
`docs/qa/evidencias/` (`output/playwright/` na fase 5).

**O que a rodada revelou e foi corrigido nesta sessão:**

1. **HomeScreen e StatementScreen voltaram para a versão do `origin/master`.**
   Mantê-las do branch (decisão inicial, §4) reprovava dois critérios de aceite
   já cumpridos pelo upstream: o painel exibia KPI inventado (`membros ativos`,
   `87% confirmado`) e o extrato tinha **gráfico de barras fixo**
   (`[42, 72, 58, 96, 64, 82]`) sem `testID`. A versão do `origin/master` calcula
   do dado real, mostra mensagem amigável com "Tentar novamente" e publica
   `statement-bar-<mês>`.
2. **A suíte de aceite estava quebrada em três frentes** (por isso ninguém a
   reexecutava desde 16/09): `esperarPor` estourava `TypeError` com predicado
   síncrono (abortava a fase 2); os checks procuravam a API em `/api/...` quando
   o app passou a chamar `/backend/...` (fase 1 check 6, fase 3 mock, fase 4
   filtro de escrita); e havia seletores/rótulos obsoletos (item de menu
   "Revisão" virou "Revisão financeira", campo de data virou `dd/mm/aaaa` com
   `DateTimeField`, chips de função viraram filtro, texto "Conflito de horário"
   agora aparece também no toast).
3. **1 AVISO (não FAIL):** o critério "tesouraria sem vínculo acessa a revisão
   pelo mobile" não tem mais caminho de menu — o `navigation.ts` do
   `origin/master` tirou "Revisão" das abas do mobile ("fica dentro do módulo
   relacionado"). A tela continua acessível por URL e a guarda de capacidade
   funciona; **é decisão de produto** se ela volta às abas (§5.5).
4. **Aviso de escala que perdeu o motivo** (reportado pelo usuário: "estou
   marcado pra uma atividade apenas, mas vieram 4 notificações"). O produto
   estava certo: é **uma notificação por escalação**, com `dedupe_key` por
   (escala, integrante) e idempotente no republicar — não tem relação com a
   quantidade de membros escalados. As 4 vinham das rodadas do próprio aceite:
   a fase 4 cria, publica (o que notifica de verdade) e cancela a escala, mas o
   aviso sobrevivia à escala cancelada. Correção de produto: cancelar a escala
   remove os avisos dela (`drop_schedule_notifications`) e remover um integrante
   remove o aviso dele (`drop_assignment_notification`), com a trilha
   administrativa preservada no `AuditLog`. Dois testes novos em
   `apps/audit/tests/test_notifications.py`; o resíduo das rodadas anteriores
   (9 escalas e 16 eventos de QA + 4 avisos) foi removido do banco de
   demonstração e o passo de purga ficou documentado em `tools/qa/README.md`.

**Ambiente do aceite (§6.1).** O `moriah-ngrok-proxy` é um **nginx** que serve o
build estático (`mobile/dist`, via `npx expo export --platform web`) na porta
9000 e faz proxy de `/backend` → `backend:8000` — é o mesmo arranjo de mesma
origem que o túnel publica. O aceite rodou contra `http://localhost:9000` porque
o ngrok gratuito intercepta navegação de navegador com a página de aviso
("You are about to visit…"): por curl (`https://saprogenic-saul-heavies.ngrok-free.dev`)
app e API respondem corretamente, mas o Playwright cairia no intersticial.


**Ambiente deixado ligado:** `moriah_app-db-1`, `moriah_app-backend-1` e
`moriah-ngrok-proxy` (nginx na porta 9000, servindo o build atual de
`mobile/dist`) estão rodando; o túnel ngrok está ativo em
`https://saprogenic-saul-heavies.ngrok-free.dev` → `localhost:9000`.
`moriah_app-mobile-1` continua parado (o app foi servido pelo build estático).

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

## 9. Ajustes de UI e de contrato pedidos na revisão do produto (24/09)

Quatro ajustes vieram da revisão do produto (não do aceite) e cada um ganhou
verificação própria:

1. **Extrato: os filtros voltaram a ser dropdown.** Os três filtros do extrato
   desktop eram botões que *ciclavam* para o próximo valor (`cycle()`), sem
   mostrar a lista nem permitir escolher direto. Voltaram a abrir a lista de
   opções (a implementação do branch foi portada para a tela consolidada, que
   mantém o gráfico com dado real e o `testID statement-bar-<mês>`).
2. **Escala recusada aparecia verde.** Cada tela reimplementava o mapa de tom do
   status, e a agenda tratava tudo que não era conflito/pendente como sucesso. O
   mapa virou fonte única (`statusTone` em `mobile/src/theme.ts`), usada por
   agenda, lista de escalas, detalhe da escala e extrato.
3. **Novo compromisso é da liderança.** O formulário inline saiu da agenda e a
   função virou um ícone circular (+) acima do calendário, oferecido apenas a
   quem cria compromisso: liderança de ministério (coordenação), liderança de
   célula, pastores e admin. O contrato vive no backend
   (`IsMinistryOrCellLeader` + exigência de vínculo de membro, porque o
   compromisso pertence a um `Member`); o app só não oferece o caminho e
   `/agenda-new` tem guarda de capacidade.
4. **Carrossel de anúncios na visão geral.** O carrossel (aviso de evento,
   comunicado e evento, com dado real de `/event-announcements/` e `/content/`)
   voltou para a Home, **entre os cards e os gráficos**.

Verificação acrescentada ao aceite (cada item virou um check):

- fase 1 check 10 — o carrossel existe, tem conteúdo e fica acima do gráfico;
- fase 2 check 2b — o membro não vê o (+), e digitar `/agenda-new` na mão recebe
  o aviso de acesso restrito e volta;
- fase 5 "Extrato: filtro abre a lista de opções e aplica a escolha" — com dois
  lançamentos (um aprovado, um pendente), escolher no dropdown filtra a lista.

Testes de backend: `apps/schedules/tests/test_personal_commitment_permissions.py`
(membro 403; coordenação, líder de célula, pastor e admin 201; liderança sem
vínculo 403). O teste antigo que afirmava "membro cria compromisso" foi
atualizado com o porquê e manteve a assertiva de isolamento por membro.

**Nota de dados de demonstração:** a conta de coordenação do seed
(`coordenacao.louvor@moriah.app`) **não tem vínculo de membro**, então ela não vê
o (+). É coerente com o backend (sem `Member` não há agenda pessoal para gravar);
se a demonstração precisar mostrar o atalho, o seed precisa criar o membro da
coordenação.

---

## 10. Próximo módulo: emissão fiscal (NFe/NFCe)

Fora do escopo do MVP atual e sem código no repositório. Quando começar, o
material de estudo está em `~/nfse_estudo` e o roteiro em
`brazilian-fiscal-documents`. Ponto de atenção: emissão fiscal exige CNPJ,
certificado digital e integração com prefeitura/SEFAZ — não é uma app Django
como as demais, e o desenho precisa nascer com idempotência e conciliação
(o livro `FinancialEntry` já é o lugar natural para o vínculo).
