# Inventário de navegação e rotas — classificação do MVP

**Data:** 16/09/2026
**Base de código:** commit `40ebc25`
**Fontes:** `mobile/src/components/Screen.tsx:49-104` (sidebar + tabs), `mobile/app/*` (rotas),
`backend/config/urls.py` (API), `backend/apps/*/models.py` (domínio disponível).
**Complementa:** §5 do plano (`docs/plano-mvp-moriah-execucao-2026-09-16.md`), Fase 2.

Legenda de status: **Implementado** (rota + tela + endpoint reais) · **MVP** (entra nesta onda,
falta ligar) · **Futuro** (fora do MVP, exige domínio/contrato novo) · **Removido** (sai da
navegação; não vira tela vazia).

---

## 1. Correção de métrica (errata do relatório de paridade)

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

## 2. Sidebar desktop (17 rótulos)

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

## 3. Tabs mobile (5)

| Tab | Rota | Status | Observação |
|---|---|---|---|
| Início | `/home` | Implementado | Dados fixos a corrigir (Fase 1.6) |
| Agenda | `/agenda` | Implementado | Eventos + compromissos pessoais reais |
| Escalas | `/schedules` | Implementado | Resposta do membro funciona |
| Contribuições | `/statement` | Implementado | Enviar contribuição em `/contribution` |
| Perfil | `/profile` | Implementado | Sem edição direta (via requisição) |

O mockup canônico usa **Conteúdo** no lugar de Contribuições. Decisão D3 em
`docs/fase-0-decisoes-2026-09-16.md`: manter Contribuições no MVP (há dado real) e adiar Conteúdo
(sem modelo).

## 4. Rotas de aplicação (13 arquivos)

| Rota | Tela | Status | API |
|---|---|---|---|
| `/` (`index.tsx`) | `LoginScreen` (ou redirect para `/home` se já autenticado) | Implementado | `POST /api/auth/login/`, `GET /api/me/` |
| `/home` | `HomeScreen` | Implementado | `/api/me/*` |
| `/agenda` | `AgendaScreen` | Implementado | `/api/me/events/`, `/api/me/agenda/` |
| `/schedules` | `SchedulesScreen` | Implementado | `/api/me/schedules/` |
| `/schedule/[id]` | `ScheduleDetailScreen` | Implementado | `/api/me/schedules/{id}/`, `.../action/` |
| `/schedule-create` | `ScheduleCreateScreen` | Implementado sem guarda de rota (C5) | `POST /api/schedules/` |
| `/statement` | `StatementScreen` | Implementado | `/api/me/statement/` |
| `/contribution` | `NewContributionScreen` | Implementado | `POST /api/contributions/` |
| `/profile` | `ProfileScreen` | Implementado | `/api/me/member/`, `/api/me/member-requests/` |
| `/notifications` | `NotificationsScreen` | Implementado (estado local) | — |
| `/notification/[id]` | `NotificationDetailScreen` | Implementado (estado local) | — |
| `/song/[id]` | `SongDetailScreen` | Implementado com bug de `scheduleId` | `/api/me/schedules/{id}/` |
| `_layout.tsx` | shell de navegação (sidebar + tabs) | Implementado | — |
| `+not-found` | — | **Ausente** (cai no "Unmatched Route" do Expo) | — |

12 rotas (`index` + 11 telas) + `_layout.tsx` = **13 arquivos**; `mobile/src/screens` tem
**12 telas** (as 11 roteadas mais a `LoginScreen`, renderizada por `/`).

## 5. Backend sem UI (o gargalo do MVP é front, não domínio)

Modelos que já existem e **não têm nenhuma rota no app**:

| Modelo | API hoje | Onda |
|---|---|---|
| `Ministry`, `MinistryRole` | nenhuma (só admin) | Fase 4.1 |
| `ScheduleItem` | nenhuma | pós-MVP (setlist) |
| `Song` | nenhuma | pós-MVP (repertório) |
| `WorshipTeam`, `WorshipTeamMember` | nenhuma | pós-MVP (bandas) |
| `Cell`, `CellMeeting`, `CellAttendance` | `POST /api/cell-meetings/`, `GET /api/leader/cell-members/` sem tela | Fase 5 (líder de célula) |
| `Family`, `FamilyRelationship` | nenhuma | Fase 6 |
| `AuditLog` | nenhuma (só admin; leitura pastoral) | Fase 3 (registro) / Fase 6 (consulta) |
| `MemberUpdateRequest` | `GET/POST /api/me/member-requests/`; aprovação só no admin | Fase 3/5 |

Endpoints existentes **sem nenhuma UI**: `POST /api/contributions/{id}/review/`,
`POST /api/schedules/{id}/publish/`, `POST /api/.../substitute/`,
`GET /api/leader/cell-members/`. Todos são capacidades prontas esperando tela — prioridade
natural das Fases 3 e 4.

## 6. Rotas inexistentes citadas no relatório

`/membros`, `/bandas`, `/escola`, `/relatorios`, `/rota-inexistente` não existem. Hoje caem no
"Unmatched Route / Sitemap" do Expo, em inglês (relatório §5.3). A correção (`app/+not-found.tsx`
em PT-BR) é Fase 1.5 — e **nenhuma delas deve virar rota vazia**: cada uma é um item das seções 2
e 5 acima.
