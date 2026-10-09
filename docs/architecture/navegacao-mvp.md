# Inventário de navegação e rotas — classificação do MVP

**Data:** 17/09/2026
**Base atual:** working tree sobre `0564ca5`, incluindo a fatia Conteúdo da Fase 6.
**Baseline histórica:** `40ebc25`, usada somente nas seções 1 e 2.
**Fontes:** `mobile/src/navigation.ts` e `mobile/src/components/Screen.tsx` (sidebar + navegação inferior), `mobile/app/*` (rotas),
`backend/config/urls.py` (API), `backend/apps/*/models.py` (domínio disponível).
**Complementa:** §5 do plano (`docs/plano-mvp-moriah-execucao-2026-09-16.md`), Fase 2.

Legenda de status: **Implementado** (rota + tela + endpoint reais) · **MVP** (entra nesta onda,
falta ligar) · **Futuro** (fora do MVP, exige domínio/contrato novo) · **Removido** (sai da
navegação; não vira tela vazia).

---

## 1. Correção de métrica histórica (baseline `40ebc25`)

O relatório afirma "19 destinos / 8 dos 16 itens apontando para o lugar errado". Contagem real
em `Screen.tsx:49-96`:

- **16 itens** de sidebar distribuídos em **8 grupos**, mais **1 item de rodapé**
  (`Configurações`) que não é `Pressable` — 17 rótulos renderizados;
- **5 destinos distintos**: `home`, `profile`, `statement`, `schedules`, `agenda`;
- **3 itens levam à tela que o rótulo promete**: Dashboard > Visão geral, Escalas, Agenda;
- **13 itens não levam**, incluindo `Financeiro > Contribuições`, que abre o extrato **pessoal**
  do membro (`/statement`) e não a gestão de contribuições que o rótulo promete;
- **1 item sem rota**: `Configurações`.

O mapa do relatório cita `Screen.tsx:56-70`; o array real é `:49-96`.

## 2. Sidebar histórica (17 rótulos no baseline, não o estado atual)

| Grupo | Item | Rota hoje | Status da capacidade | Decisão de MVP |
|---|---|---|---|---|
| Dashboard | Visão geral | `/home` | Implementado (com dados fixos) | Implementado — corrigir dados (Fase 1.6) |
| Pessoas | Membros | `/profile` | **Futuro** — edição de cadastro é do Django Admin (`manage_members`); não existe endpoint de listagem | Ocultar |
| Pessoas | Visitantes | `/profile` | **Removido** — não existe modelo `Visitor` | Removido da navegação |
| Financeiro | Visão geral | `/home` | **MVP** — falta endpoint de resumo financeiro | Ocultar até existir resumo |
| Financeiro | Contribuições | `/statement` | **Implementado** como extrato pessoal; **Futuro** como gestão | Renomear para "Meu extrato" no mobile; gestão entra na Fase 3 |
| Financeiro | Relatórios | `/statement` | **Futuro** — agregação sobre `Contribution` | Ocultar |
| Ministérios | Ministérios | `/schedules` | **MVP** — `Ministry`/`MinistryRole` existem, sem API | Fase 4.1 |
| Ministérios | Escalas | `/schedules` | **Implementado** | Implementado |
| Louvor | Setlists | `/schedules` | **Futuro** — `Song`/`ScheduleItem` existem, sem API | Ocultar (fora do corte de escalas, plano §9) |
| Louvor | Repertório | `/schedules` | **Futuro** — idem | Ocultar |
| Louvor | Bandas | `/schedules` | **Futuro** — `WorshipTeam` existe, sem API | Ocultar |
| Ensino | Escola Bíblica | `/agenda` | **Removido do MVP** — não existe modelo | Ocultar |
| Ensino | Turmas | `/agenda` | **Removido do MVP** — idem | Ocultar |
| Cultos e eventos | Agenda | `/agenda` | **Implementado** (`/api/me/events/`, `/api/me/agenda/`) | Implementado |
| Cultos e eventos | Cultos | `/agenda` | **MVP** — `Event` existe; falta detalhe do evento | Ocultar até existir detalhe |
| Conteúdo | Palavras | `/home` | **Removido do MVP** — não existe modelo | Ocultar |
| (rodapé) | Configurações | **nada** | **Removido do MVP** — não existe tela | Removido da navegação |

**Regra de exibição (Fase 2):** item visível = capacidade + rota + tela coerente com o rótulo.
Fora disso, ocultar. "Em breve" só é aceitável se não existir rota — nunca apontar para outra tela.

## 3. Navegação atual

A sidebar do membro contém Visão geral (`/home`), Agenda (`/agenda`), Escalas
(`/schedules`), Conteúdo (`/content`, capacidade `read_content`) e Meu extrato (`/statement`). Revisão financeira (`/finance-review`)
exige `review_contributions` ou `manage_all`; Gestão de escalas (`/schedule-admin`)
e Criar escala (`/schedule-create`) exigem capacidade de escalas. A fonte única
é `mobile/src/navigation.ts`, filtrada pelas capacidades do perfil.

No mobile são **quatro abas e uma ação central**, cinco destinos visíveis:

| Tab | Rota | Status | Observação |
|---|---|---|---|
| Início | `/home` | Implementado | Dados da API e estados vazios |
| Agenda | `/agenda` | Implementado | Eventos + compromissos pessoais reais |
| Nova contribuição (ação central) | `/contribution` | Implementado | O rótulo acessível é "Nova contribuição", não uma aba de extrato |
| Conteúdo | `/content` | Implementado na Fase 6 | Lista, detalhe e fluxo de publicação; acesso via `read_content` |
| Perfil | `/profile` | Implementado | Sem edição direta (via requisição) |

Escalas é acessível pelo módulo Agenda; o extrato tem acesso pelo perfil.
O array `ABAS` inclui Contribuições, mas `BottomNav` substitui esse item pela ação
central acima. Os verificadores devem conferir o que é renderizado, não só o array.

O mockup canônico usa **Conteúdo** no lugar de Contribuições. A decisão D3 registrou a
prioridade de Contribuições no MVP e o adiamento de Conteúdo por falta de modelo. Na abertura da
Fase 6, Conteúdo retorna como item do menu mobile e mantém a ação central de contribuição; a
entrada agora leva à lista real, com detalhe e publicação para `manage_content`.
O contrato atual está em `docs/architecture/conteudo-api.md`; D3 permanece registro histórico do MVP.

## 4. Rotas de aplicação

| Rota | Tela | Status | API |
|---|---|---|---|
| `/` (`index.tsx`) | `LoginScreen` (ou redirect para `/home` se já autenticado) | Implementado | `POST /api/auth/login/`, `GET /api/me/` |
| `/home` | `HomeScreen` | Implementado | `/api/me/*` |
| `/agenda` | `AgendaScreen` | Implementado | `/api/me/events/`, `/api/me/agenda/` |
| `/schedules` | `SchedulesScreen` | Implementado | `/api/me/schedules/` |
| `/schedule/[id]` | `ScheduleDetailScreen` | Implementado | `/api/me/schedules/{id}/`, `.../action/` |
| `/schedule-create` | `ScheduleCreateScreen` | Implementado com guarda de capacidade | `POST /api/schedules/`, `/api/ministries/` |
| `/schedule-admin` | `ScheduleAdminScreen` | Implementado com guarda | `GET /api/schedules/` |
| `/schedule-admin/[id]` | `ScheduleAdminDetailScreen` | Implementado com guarda | detalhe, edição, candidatos, equipe, publicação, cancelamento e substituição |
| `/finance-review` | `FinanceReviewScreen` | Implementado com guarda | `/api/contributions/`, `.../{id}/review/` |
| `/agenda-new` | `NewCommitmentScreen` | Implementado | `POST /api/me/agenda/` |
| `/content` | `ContentScreen` | Implementado na Fase 6 | `/api/content/` |
| `/content/[id]` | `ContentScreen` (detalhe) | Implementado na Fase 6 | `/api/content/{id}/`, `/publish/`, `/unpublish/` |
| `/statement` | `StatementScreen` | Implementado | `/api/me/statement/` |
| `/contribution` | `NewContributionScreen` | Implementado | `POST /api/contributions/` |
| `/profile` | `ProfileScreen` | Implementado | `/api/me/member/`, `/api/me/member-requests/` |
| `/notifications` | `NotificationsScreen` | Implementado (persistente) | `/api/me/notifications/` |
| `/notification/[id]` | `NotificationDetailScreen` | Implementado (persistente) | `/api/me/notifications/{id}/` |
| `/song/[id]` | `SongDetailScreen` | Compatibilidade técnica, fora do corte de repertório | `/api/me/schedules/{scheduleId}/` |
| `_layout.tsx` | shell de navegação (sidebar + tabs) | Implementado | — |
| `+not-found` | fallback PT-BR | Implementado | — |

17 rotas, `_layout.tsx` e `+not-found.tsx` = **19 arquivos**.
Os contratos usam `/api/`; o servidor também publica `/backend/` e `/local-api/`.
A URL pública padrão do app é `/backend`. O QA aceita os três prefixos.

## 5. Backend sem UI (o gargalo do MVP é front, não domínio)

Estado atual dos domínios e operações:

| Modelo | API hoje | Onda |
|---|---|---|
| `Ministry`, `MinistryRole` | `/api/ministries/`; seleção na criação/equipe | Implementado na Fase 4 |
| `ScheduleItem` | leitura no detalhe pessoal de escala, sem gestão completa | pós-MVP (setlist) |
| `Song` | leitura de compatibilidade no detalhe musical, sem gestão completa | pós-MVP (repertório) |
| `WorshipTeam`, `WorshipTeamMember` | nenhuma | pós-MVP (bandas) |
| `Cell`, `CellMeeting`, `CellAttendance` | `POST /api/cell-meetings/`, `GET /api/leader/cell-members/` sem tela | Fase 5 (líder de célula) |
| `Family`, `FamilyRelationship` | nenhuma | Fase 6 |
| `AuditLog` | nenhuma (só admin; leitura pastoral) | Fase 3 (registro) / Fase 6 (consulta) |
| `MemberUpdateRequest` | `GET/POST /api/me/member-requests/`; aprovação só no admin | Fase 3/5 |

Revisão financeira, publicação e substituição de escala **já têm UI no app**.
Continuam sem UI operacional: células/reuniões e aprovação cadastral (esta permanece
no Django Admin). Não interpretar a existência de modelos/API como conclusão da tela.

## 6. Rotas inexistentes citadas no relatório

`/membros`, `/bandas`, `/escola`, `/relatorios`, `/rota-inexistente` não existem e
usam o fallback PT-BR de `app/+not-found.tsx`. Nenhuma deve ganhar tela vazia.
