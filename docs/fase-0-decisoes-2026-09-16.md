# Fase 0 — Decisões fechadas e decisões pendentes de produto

**Data:** 16/09/2026
**Base de código:** commit `40ebc25` (ver `docs/qa/baseline-2026-09-16.md`)
**Plano:** `docs/plano-mvp-moriah-execucao-2026-09-16.md` §5
**Artefatos irmãos:** `docs/architecture/capacidades-mvp.md`, `docs/architecture/navegacao-mvp.md`

Este documento fecha o que a Fase 0 pôde decidir com evidência de código e isola o que depende
de decisão de produto (seção 5). As decisões de produto têm **recomendação explícita** e um
**padrão adotado** — se o usuário não contestar, o padrão é o que a Fase 1 executa.

---

## 1. Escopo do MVP (fechado)

**Dentro:** autenticação, home/dashboard, agenda, contribuições (envio + extrato), gestão
financeira (revisão de contribuição), escalas (ver, responder, criar por quem coordena, publicar,
substituir), perfil, notificações básicas, células para líder de célula.

**Fora:** Escola Bíblica/turmas, repertório/setlist/bandas, palavras, família, diretório,
relatórios financeiros, configurações. Nenhum desses itens ganha rota, tela vazia ou shell de
navegação (§6 do plano, §2 da navegação).

**Critério de corte:** entra no MVP só o que tem (a) dado real no backend **ou** (b) modelo de
domínio já existente **e** (c) fluxo de aceite por papel. "Escola Bíblica" falha em (b);
"Gestão financeira" passa porque `POST /api/contributions/{id}/review/` já existe.

## 2. Dashboard sem dados (fechado)

Regra única, válida para desktop e mobile:

1. **Nunca** exibir número fixo como se fosse dado real. Valores de demonstração só com marcador
   visível ("exemplo") — e a meta do MVP é eliminá-los.
2. Sem dado: o card mostra estado vazio próprio (`Sem dados no período`, `Nenhuma escala
   publicada`, `Nenhuma contribuição registrada`), não zero nem número de amostra.
3. Card cujo dado **não tem endpoint** é removido da tela até existir endpoint (KPIs de
   membros ativos, contagem de cultos futuros, gráfico de barras, "Atividades recentes").
4. Fallback financeiro (`R$ 12.450` no desktop, `R$ 450` no mobile) é eliminado: sem contribuição,
   o card diz `Nenhuma contribuição registrada` — um valor de arrecadação falso na conta da
   tesouraria é risco operacional, não estética.
5. `Ler palavra` em `HomeScreen.tsx:247` não pode navegar para `/statement`; a ação é removida
   com o card (Palavras está fora do MVP).

Evidência: relatório de paridade §1.4 e §5.5; `HomeScreen.tsx:48-53,71,92-100,220-247`.

## 3. Escopo de tenant/igreja (auditado)

Multitenant por `church` em todas as consultas. Resultado da auditoria:

| Endpoint | Escopo aplicado | Situação |
|---|---|---|
| `POST /api/auth/login/`, `/refresh/` | por usuário | ok |
| `GET /api/me/` | pela conta | ok |
| `GET /api/me/member/` | `member_profile` da conta | ok |
| `/api/me/member-requests/` | `member` + `church`; `perform_create` força ambos | ok |
| `GET /api/me/statement/` | `member` + `church` | ok |
| `GET /api/me/events/` | `church` + `active` + janela de 1 dia | ok |
| `GET /api/me/schedules/`, `/{id}/` | `member` + `church` + escala publicada | ok |
| `POST /api/me/schedules/{id}/action/` | `get_object_or_404(member=..., church=...)` | ok |
| `/api/me/agenda/` | `member` + `church`; criação força `church` | ok |
| `POST /api/contributions/` | `church` e `member` forçados no `save` | ok |
| `POST /api/contributions/{id}/review/` | queryset `church=user.church` | ok |
| `POST /api/schedules/` | `church` forçado no serializer; cria `Event` + `Schedule` | ok no tenant; **sem guarda de ministério** (C1) |
| `POST /api/schedules/{id}/publish/` | `church` + `can_manage_schedule` | ok |
| `POST /api/schedules/{pk}/assignments/{pk}/substitute/` | `schedule`, `assignment`, `member` e `role` todos com `church=user.church` | ok (referência de qualidade) |
| `GET /api/leader/cell-members/` | `filter(cell__leader=user)` — **sem `church` explícito** | risco baixo (T1) |
| `POST /api/cell-meetings/` | `Cell.objects.filter(leader=user).first()` — **sem `church`**; grava `church=user.church` | risco (T2) |

**Decisão T (fechada):** toda consulta nova filtra por `church` **explicitamente**, incluindo onde
o filtro indireto já bastaria. Os dois pontos de célula (T1/T2) entram como correção da Fase 5
(`cells` é a única área que não segue o padrão do projeto), não como bloqueio do MVP: exigem um
usuário que lidere célula de outra igreja, cenário que o seed não cria.

**Decisão T2 (fechada):** nenhum endpoint novo pode receber `church` do cliente. Sempre
`request.user.church`.

## 4. Transições de estado (auditado)

### 4.1 Contribuição — `Contribution.Status`

Estados: `pending` (padrão), `approved`, `rejected`, `needs_review`.
Endpoint: `POST /api/contributions/{id}/review/` (`finance/views.py:58-67`).

| Regra | Situação hoje | Decisão do MVP |
|---|---|---|
| Transições válidas | **Qualquer estado → qualquer estado**: não há máquina de estados | Permitir `pending`/`needs_review` → `approved`/`rejected`; bloquear re-decisão de item já `approved`/`rejected` (409) |
| Motivo de rejeição | `review_notes` opcional | **Obrigatório** ao `rejected` (422 com mensagem) |
| Idempotência | Nenhuma: reenviar `approved` regrava `reviewed_at` | Re-decisão igual retorna 200 sem efeito (idempotente) |
| Auditoria | Só `reviewed_by` + `reviewed_at`; `AuditLog` existe e **não é usado** | Gravar `AuditLog` a cada decisão |
| Escopo | `church` ok | manter |

Mudanças de backend entram na Fase 3 (`finance`), com teste por transição proibida.

### 4.2 Escala — `Schedule.Status`

Estados: `draft`, `published`, `cancelled` — **o padrão do campo é `published`**
(`schedules/models.py`), e o contrato de criação (`ScheduleCreateSerializer:130`) também assume
`published` por padrão.

| Regra | Situação hoje | Decisão do MVP |
|---|---|---|
| Criação | `POST /api/schedules/` cria `Event` + `Schedule` com status `published` e **sem nenhuma função/pessoa** | Criar como `draft`; publicar é ação explícita (endpoint já existe) |
| Publicação | Bloqueia só `cancelled`; republicar regrava `published_at` | Idempotente: se já publicado, 200 sem efeito |
| Cancelamento | **Não existe endpoint** | Criar na Fase 4.1 (o plano §12 já pede avaliação de risco) |
| Escopo de ministério na criação | **Não verificado** (C1) | Aplicar `can_manage_schedule` também à criação |
| Criação com ministério | Contrato não aceita ministério/funções | Estender na Fase 4.1 |

### 4.3 Escala — `ScheduleAssignment.Status`

Estados: `pending`, `confirmed`, `declined`, `unavailable`, `conflict`, `replacement_needed`.
Endpoint: `POST /api/me/schedules/{id}/action/` (`schedules/views.py:85-115`).

| Regra | Situação hoje | Decisão do MVP |
|---|---|---|
| Ações aceitas | `confirm`, `decline`, `unavailable` | manter |
| Justificativa | Obrigatória para `decline`/`unavailable` (serializer) | manter |
| Conflito de horário | Detectado no `confirm`: grava `conflict` + `conflict_reason` e devolve **409** | manter; a UI precisa explicar o 409 (Fase 4) |
| Re-resposta | Permitida sem guarda (confirmar → recusar → confirmar) | Permitir enquanto a escala não estiver `cancelled`; guardar histórico é Fase 5 |
| Substituição | Cria nova `ScheduleAssignment` com `substitution_for`, marca a original como `replacement_needed` — **sem aprovação** | Manter automático; aprovação de substituição é decisão de produto (D5) |
| Duplicidade | `unique_together (schedule, member, ministry_role)` protege | manter |

## 5. Decisões pendentes de produto (precisam de aprovação)

Cada item tem recomendação e padrão. **Sem resposta do usuário, o padrão é executado.**

**D1 — Papéis com conta no seed.** Não existem contas `secretary`, `coordinator` e `pastor`;
logo `manage_members`, `manage_schedules` e `manage_pastoral` não têm verificação de ponta a
ponta, e a Fase 4 (a mais longa) fica sem QA possível.
*Recomendação:* criar as três contas no `seed_mvp` (+1 membro por conta quando o papel exigir
perfil). **Padrão: criar (D1 = sim).**
Impacto se não fizer: Fase 4 não fecha o critério de aceite "admin cria escala completa" com
papel de coordenação real.

**D2 — Onde mora a gestão no MVP: app ou Django Admin?**
O PRD §15 decidiu Admin; o plano do MVP pede gestão financeira **no app**.
*Recomendação:* gestão **no app** para o que tem contrato pronto (revisar contribuição, publicar
escala, substituir), e Admin para o resto (cadastro de membro, ministério, evento).
**Padrão: app para revisar contribuição e operar escalas; Admin para cadastros.**

**D3 — Tab mobile "Conteúdo" vs. "Contribuições".**
O mockup canônico usa Conteúdo; o app tem Contribuições.
*Recomendação:* manter Contribuições no MVP (tem dado real) e adiar Conteúdo (sem modelo).
**Padrão: Contribuições.**

**D4 — O que fazer com os 13 itens de sidebar que não levam à tela prometida, mais `Configurações`.**
*Recomendação:* ocultar todos (ver `docs/architecture/navegacao-mvp.md` §2); nada de "Em breve"
nesta rodada. **Padrão: ocultar.** Mostrar "Em breve" só após a Fase 2 validar que a sidebar
curta é legível.

**D5 — Substituição exige aprovação?**
Hoje é automática (coordenador troca e pronto).
*Recomendação:* automática no MVP (é operação de coordenação, não de membro).
**Padrão: automática.**

**D6 — Cancelamento de escala entra no MVP?**
Não existe endpoint hoje.
*Recomendação:* entrar na Fase 4.1 — cancelar é a única saída para escala publicada errada, e sem
isso a operação "publica e não pode desfazer" (§12 do plano).
**Padrão: entra na Fase 4.1.**

**D7 — Notificações: reais ou removidas?**
Hoje são estado local em memória (`/notifications`), sem badge persistente.
*Recomendação:* remover o badge falso agora (Fase 1) e implementar notificação persistente na
Fase 5; até lá a tela permanece com aviso de que não há histórico real.
**Padrão: badge removido na Fase 1; persistência na Fase 5.**

**D8 — Conta sem `member_profile` (tesouraria/líder de célula no seed).**
O app mostra telas pessoais que o backend rejeita com 403.
*Recomendação:* caminho explícito "vincular meu cadastro de membro" (Fase 5) e, até lá, ocultar
as áreas pessoais quando faltar `member`.
**Padrão: ocultar + mensagem; vínculo na Fase 5.**

## 6. Pendências técnicas registradas (não são decisões de produto)

- C1 `POST /api/schedules/` sem `can_manage_schedule` — Fase 4.1.
- C2 `pastor` passa em `IsScheduleCoordinatorOrAdmin` mas não recebe `manage_schedules` — alinhar
  na Fase 2 (senão a UI esconde o que o backend permite).
- C3 não existe listagem de membros da igreja — Fase 4.2 (formação de equipe).
- C4 aprovação de requisição cadastral só no Admin — Fase 3/5.
- C5 ausência de guarda de rota no cliente — Fase 1.4.
- C6 sem caminho de vínculo de cadastro na UI — Fase 5.
- T1/T2 `cells` sem filtro explícito de `church` — Fase 5.
