# Matriz de capacidades — MVP

**Data:** 16/09/2026
**Base de código:** commit `40ebc25`
**Fontes:** `backend/apps/accounts/permissions.py`, `backend/apps/accounts/roles.py`,
`backend/apps/accounts/models.py`, `backend/config/urls.py` e as views de cada app.
**Complementa:** `docs/architecture/contas-e-capacidades.md` (regras de experiência da conta).

Este documento fecha a matriz iniciada no plano (§3.1), resolve as células "A decidir" e
liga cada capacidade a um endpoint real, a um guard e a um fluxo de aceite.

---

## 1. Capacidades expostas pelo backend

`user_capabilities(user)` (`permissions.py:68-85`) devolve a lista abaixo. É o contrato que o
app deve usar para montar navegação e guardas — não o papel principal da conta.

| Capacidade | Atribuída quando | Papel de produto |
|---|---|---|
| `member` | existe `member_profile` vinculado | Membro |
| `manage_all` | `is_superuser` ou papel `admin` | Administração |
| `manage_pastoral` | papel `pastor` | Pastoral |
| `manage_members` | papel `secretary` | Secretaria |
| `review_contributions` | papel `treasurer` | Tesouraria |
| `manage_schedules` | papel `admin`, `pastor` ou `coordinator` | Administração e liderança/coordenação de ministério |
| `manage_cells` | papel `cell_leader` | Líder de célula |

Dois pontos que a UI precisa respeitar:

- `member` **não** é derivada de papel nem de `is_superuser`. A conta
  `admin@moriah.app` do seed é superusuário **e** tem `member_profile`; a
  `tesouraria@moriah.app` e a `lider.celula@moriah.app` **não** têm. Logo existe
  conta administrativa sem experiência pessoal e não existe "superusuário é membro".
- Papéis somam (`User.assigned_roles()`): a mesma conta pode ser membro **e** gestão.
  Por isso a navegação é montada por capacidade, não por "tipo de conta".

## 2. Guardas existentes por endpoint

| Endpoint | Guard | Arquivo |
|---|---|---|
| `POST /api/contributions/` | `HasMemberProfile` | `finance/views.py:32,36-39` |
| `POST /api/contributions/{id}/review/` | `IsTreasurerOrAdmin` (`superuser`/`admin`/`treasurer`) | `finance/views.py:36-38`, `permissions.py:15-22` |
| `GET /api/me/statement/` | `HasMemberProfile` | `finance/views.py:12-25` |
| `POST /api/schedules/` | `IsScheduleCoordinatorOrAdmin` (`superuser`/`admin`/`pastor`/`coordinator`) | `schedules/views.py:118-120` |
| `POST /api/schedules/{id}/publish/` | idem **+** `can_manage_schedule()` | `schedules/views.py:123-139` |
| `POST /api/schedules/{pk}/assignments/{pk}/substitute/` | idem **+** `can_manage_schedule()` | `schedules/views.py:142-173` |
| `GET /api/me/schedules/`, `/api/me/schedules/{id}/` | `HasMemberProfile` | `schedules/views.py:52-82` |
| `POST /api/me/schedules/{id}/action/` | `HasMemberProfile` (só na própria escala) | `schedules/views.py:85-115` |
| `/api/me/agenda/` (CRUD) | `HasMemberProfile` | `schedules/views.py:180-194` |
| `GET /api/leader/cell-members/`, `POST /api/cell-meetings/` | `IsCellLeaderOrAdmin` | `cells/views.py` |
| `/api/me/`, `/api/me/member/`, `/api/me/member-requests/`, `/api/me/events/` | `IsAuthenticated` / `HasMemberProfile` | `accounts/views.py`, `members/views.py`, `events/views.py` |

`can_manage_schedule(user, schedule)` (`schedules/views.py:44-49`): `superuser`/`admin`/`pastor`
gerenciam qualquer escala; `coordinator` só gerencia escala que tenha ao menos uma função
(`ministry_role`) de ministério em que ele consta como coordenador
(`ministry_role__ministry__coordinators=user`).

## 3. Matriz de capacidades do MVP (células "A decidir" resolvidas)

| Capacidade de produto | Membro | Líder (coordenação de ministério) | Tesouraria | Admin |
|---|---:|---:|---:|---:|
| Ver dados próprios (perfil, extrato, escalas, agenda) | Sim | Sim | Não (sem `member_profile`) | Sim |
| Enviar contribuição | Sim | Sim | Não (sem `member_profile`) | Sim |
| Aprovar / rejeitar contribuição | Não | Não | **Sim** | Sim |
| Ver gestão financeira da igreja | Não | Não | **Sim** | Sim |
| Criar e gerenciar escala | Não | **Sim, apenas nos ministérios que coordena** | Não | Sim |
| Publicar e substituir escalado | Não | **Sim, no escopo do ministério** | Não | Sim |
| Responder à própria escala (confirmar/recusar/indisponível) | Sim | Sim | Não (sem `member_profile`) | Sim |
| Gerenciar membros (cadastro) | Não | **Não** — só leitura de quem serve no seu ministério | **Não** — só leitura para conciliar contribuição | Sim (e Secretaria) |
| Registrar reunião de célula | Não | **Sim, se `cell_leader` da célula** | Não | Sim |

### Justificativa das duas células "A decidir"

**Criar e gerenciar escala → Líder: sim, com escopo de ministério.**
O consentimento já existe no backend: `can_manage_schedule()` autoriza `coordinator` apenas em
escalas que contenham função de ministério que ele coordena. O "Líder" do mockup é o líder
**de ministério** (louvor), que no backend é o papel `coordinator` — não confundir com
`cell_leader` (célula, `manage_cells`). A UI deve, portanto:
(a) mostrar a área de gestão de escalas somente com `manage_schedules`/`manage_all`;
(b) nunca deixar o app decidir o escopo do ministério — o backend é a autoridade;
(c) tratar `403` como estado visível ("Você não coordena o ministério desta escala").

**Gerenciar membros → Líder: não.**
Quem edita cadastro é a Secretaria (`manage_members`) e o Admin. O líder precisa **ler** as
pessoas elegíveis para montar a equipe; isso é leitura, não edição. A leitura precisa de um
endpoint próprio — implementado na Fase 4.2 como `GET /api/schedules/{id}/candidates/`
(membros ativos da igreja, com conflito de agenda e marcação de já escalado) e
`GET /api/ministries/` (ministérios que a conta pode usar), sem reuso de rota de edição.

## 4. Lacunas encontradas na auditoria (viram ticket, não ficam implícitas)

| # | Lacuna | Evidência | Onde corrigir |
|---|---|---|---|
| C1 | Resolvida: `POST /api/schedules/` resolve o ministério informado e recusa (400) quando a conta não o coordena; coordenador sem `ministry_id` também é recusado | `schedules/serializers.py` (`validate`) + `apps/schedules/tests/test_schedule_admin.py` | Resolvida na Fase 4.1 |
| C2 | Resolvida: `user_capabilities` publica `manage_schedules` para os papéis aceitos por `IsScheduleCoordinatorOrAdmin` | `backend/apps/accounts/permissions.py` e testes de capacidades | Resolvida na Fase 2 |
| C3 | Resolvida: `GET /api/ministries/` (ministérios administráveis) e `GET /api/schedules/{id}/candidates/` (membros ativos com conflito de agenda e marcação de já escalado) | `ministries/views.py`, `schedules/views.py` + `apps/schedules/tests/test_schedule_admin.py` | Resolvida na Fase 4.2 |
| C4 | Aprovação de requisição cadastral só existe no Django Admin (`member-requests` expõe só criar/listar) | `members/views.py:20-39` | Fase 3/5 |
| C5 | Resolvida: guarda de rota no cliente cobre `/schedule-create` **e** `/schedule-admin(/<id>)`; sem a capacidade o app não renderiza a lista administrativa (mostra aviso em PT-BR na própria página) | `mobile/app/_layout.tsx` (`ROTAS_DE_GESTAO`, `PREFIXOS_DE_GESTAO`, `AcessoRestritoEscalas`) + `tools/qa/checks/fase4.mjs` (check 1) e `fase1.mjs` (check 2) | Resolvida na Fase 1.4 / 4 |
| C6 | Conta sem `member_profile` não tem caminho de "vincular meu cadastro" na UI | `docs/architecture/contas-e-capacidades.md` + `HasMemberProfile.message` | Fase 1.4 / 5 |

## 5. Regras de interface derivadas da matriz

1. Navegação e abas são geradas por capacidade (`api/me/` → `capabilities`), nunca por papel
   principal nem por `is_superuser` lido no cliente.
2. Sem `member`: ocultar perfil, contribuições, escalas e agenda pessoais; não exibir mensagem
   de erro cruas do backend (ver §5.10 do relatório de paridade).
3. Com `manage_*` e sem `member`: entrar direto na área de gestão, sem tentar renderizar
   telas pessoais.
4. Toda tela de escrita precisa de guarda **de rota** (não só de botão), porque o formulário
   já é a promessa de um fluxo permitido.
5. Nenhuma tela nova sem capacidade, papel e fluxo de aceite associados (gate da Fase 0).

## 6. Contas de QA

O seed (`backend/apps/accounts/management/commands/seed_mvp.py`) fornece 4 contas:

| Conta | Papel principal | `is_staff` | `is_superuser` | `member_profile` | Capacidades |
|---|---|---:|---:|---|---|
| `admin@moriah.app` | member + `admin` (papel somado) | Sim | **Sim** | Sim | `member`, `manage_all` |
| `tesouraria@moriah.app` | treasurer | Sim | Não | Não | `review_contributions` |
| `membro@moriah.app` | member | Não | Não | Sim | `member` |
| `lider.celula@moriah.app` | cell_leader | Não | Não | Não | `manage_cells` |

**Lacuna de cobertura de QA:** não existe conta de seed para `secretary`, `coordinator` e
`pastor`. Sem elas, `manage_members`, `manage_schedules` (a célula que mais importa na Fase 4) e
`manage_pastoral` não têm verificação de ponta a ponta. A decisão **D1** em
`docs/fase-0-decisoes-2026-09-16.md` propõe criar essas três contas no seed.
