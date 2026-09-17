# Fase 0 — Decisões fechadas e decisões pendentes de produto

**Data:** 17/09/2026 (revisão pós-estabilização da fase 5)
**Base atual:** working tree sobre `402b3c2` (`codex/moriah-navigation-admin`).
**Baseline histórica:** `40ebc25` (ver `docs/qa/baseline-2026-09-16.md`).
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

**Fora:** Escola Bíblica/turmas, repertório/setlist/bandas, palavras/conteúdo, família, diretório,
relatórios financeiros, configurações. Nenhum desses itens ganha shell vazio de navegação.
Rotas técnicas preexistentes de música e conteúdo não constituem entrega de domínio;
Conteúdo informa explicitamente que está fora do MVP.

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
| `GET /api/me/statement/` | membro: `member` + `church`; admin: consolidado da própria igreja | ok; leitura administrativa deliberada |
| `GET /api/me/events/` | `church` + `active` + janela de 1 dia | ok |
| `GET /api/me/schedules/`, `/{id}/` | membro: `member` + `church` + escala publicada; admin: leitura da própria igreja | ok; leitura administrativa não autoriza responder por outro membro |
| `POST /api/me/schedules/{id}/action/` | `get_object_or_404(member=..., church=...)` | ok |
| `/api/me/agenda/` | `member` + `church`; criação força `church` | ok |
| `POST /api/contributions/` | `church` e `member` forçados no `save` | ok |
| `POST /api/contributions/{id}/review/` | queryset `church=user.church` | ok |
| `POST /api/schedules/` | `church` forçado; ministério validado pelo escopo da coordenação | resolvido (C1) |
| `POST /api/schedules/{id}/publish/` | `church` + `can_manage_schedule` | ok |
| `POST /api/schedules/{pk}/assignments/{pk}/substitute/` | `schedule`, `assignment`, `member` e `role` todos com `church=user.church` | ok (referência de qualidade) |
| `GET /api/leader/cell-members/` | filtra explicitamente `church` da conta e líder da célula | resolvido |
| `POST /api/cell-meetings/` | busca a célula por `church` + líder; grava `church=user.church` | resolvido |
| `/api/me/notifications/` e ações de leitura | `church` + `recipient=request.user` em todas as consultas | implementado e testado |

**Decisão T (fechada):** toda consulta nova filtra por `church` **explicitamente**, incluindo onde
o filtro indireto já bastaria. Os dois pontos de célula (T1/T2) foram alinhados a esse padrão.

**Decisão T2 (fechada):** nenhum endpoint novo pode receber `church` do cliente. Sempre
`request.user.church`.

## 4. Transições de estado (auditado)

### 4.1 Contribuição — `Contribution.Status`

Estados: `pending` (padrão), `approved`, `rejected`, `needs_review`.
Endpoint: `POST /api/contributions/{id}/review/` (`finance/views.py:58-67`).

| Regra | Situação hoje | Decisão do MVP |
|---|---|---|
| Transições válidas | `pending`/`needs_review` → `approved`/`rejected`; decisão final diferente bloqueada (409) | Implementado |
| Motivo de rejeição | Obrigatório ao `rejected` (422) | Implementado |
| Idempotência | Re-decisão igual retorna 200 sem regravar | Implementado |
| Auditoria | Decisão registra trilha; notificação persistente na mesma transação | Implementado |
| Escopo | `church` ok | manter |

Mudanças de backend da Fase 3 (`finance`) têm testes por transição proibida.

### 4.2 Escala — `Schedule.Status`

Estados: `draft`, `published`, `cancelled`. O padrão histórico do **modelo** continua
`published`, mas o **contrato da API de criação** cria `draft` e exige publicação explícita.
Não confundir criação via ORM/Admin com o fluxo operacional do app.

| Regra | Situação hoje | Decisão do MVP |
|---|---|---|
| Criação | API cria rascunho com evento e ministério | Implementado |
| Publicação | Exige equipe; publicação, notificações e auditoria são atômicas; repetição idempotente | Implementado; lock somente da escala, sem bloquear JOINs opcionais |
| Cancelamento | Endpoint `/api/schedules/{id}/cancel/`, idempotente e auditado com status anterior real | Implementado |
| Escopo de ministério na criação | Coordenação limitada aos ministérios sob sua responsabilidade | Implementado (C1) |
| Criação com ministério | Seleção de ministério e formação da equipe no detalhe administrativo | Implementado na Fase 4 |

### 4.3 Escala — `ScheduleAssignment.Status`

Estados: `pending`, `confirmed`, `declined`, `unavailable`, `conflict`, `replacement_needed`.
Endpoint: `POST /api/me/schedules/{id}/action/` (`schedules/views.py:85-115`).

| Regra | Situação hoje | Decisão do MVP |
|---|---|---|
| Ações aceitas | `confirm`, `decline`, `unavailable` | manter |
| Justificativa | Obrigatória para `decline`/`unavailable` (serializer) | manter |
| Conflito de horário | Recalcula escalas e compromissos pessoais; grava `conflict` e responde 409 com `detail` e `code=schedule_conflict` | UI explica o motivo e recarrega o estado |
| Re-resposta | API bloqueia rascunhos/canceladas; tela permite alterar resposta enquanto publicada | Implementado; histórico completo permanece fora desta rodada |
| Substituição | Cria nova `ScheduleAssignment` com `substitution_for`, marca a original como `replacement_needed` — **sem aprovação** | Manter automático; aprovação de substituição é decisão de produto (D5) |
| Duplicidade | `unique_together (schedule, member, ministry_role)` protege | manter |

## 5. Registro das decisões de produto

As recomendações abaixo registram o contexto do baseline. O estado efetivamente
implementado está nas seções 3, 4 e 6 e no relatório da fase 5. Este registro não
constitui autorização nova para alterar produto, publicar ou fazer deploy.

**D1 — Papéis com conta no seed (contexto histórico).** No baseline não existiam contas `secretary`, `coordinator` e `pastor`;
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
Não existia endpoint no baseline; agora há endpoint e UI.
*Recomendação:* entrar na Fase 4.1 — cancelar é a única saída para escala publicada errada, e sem
isso a operação "publica e não pode desfazer" (§12 do plano).
**Padrão: entra na Fase 4.1.**

**D7 — Notificações: reais ou removidas?**
No baseline eram estado local em memória (`/notifications`), sem badge persistente.
*Recomendação:* remover o badge falso agora (Fase 1) e implementar notificação persistente na
Fase 5; até lá a tela permanece com aviso de que não há histórico real.
**Padrão: badge removido na Fase 1; persistência na Fase 5.** A persistência agora usa
`Notification` no app de auditoria, com destinatário por usuário, escopo explícito de igreja,
leitura individual e em lote; o sino consulta o contador real.

**D8 — Conta sem `member_profile` (tesouraria/líder de célula no seed).**
O app mostra telas pessoais que o backend rejeita com 403.
*Recomendação:* caminho explícito "vincular meu cadastro de membro" (Fase 5) e, até lá, ocultar
as áreas pessoais quando faltar `member`.
**Padrão: ocultar + mensagem; vínculo na Fase 5.**

## 6. Situação das pendências técnicas (estado atual)

- C1 resolvido: criação valida escopo de ministério.
- C2 resolvido: pastor recebe `manage_schedules`; UI e permissão alinhadas.
- C3 resolvido para formação de equipe: endpoint de candidatos por escala;
  diretório geral continua fora do MVP.
- C4 pendente no app: aprovação cadastral continua no Django Admin.
- C5 resolvido para gestão: guardas de rota por capacidade e fallback PT-BR.
- C6 resolvido no complemento da Fase 5: há solicitação autenticada de vínculo
  por e-mail, sem escolha de `member_id` pelo cliente e com aprovação humana
  no Admin. A decisão histórica de ocultar as áreas pessoais continua válida
  até a aprovação.
- T1/T2 resolvidos: células filtram explicitamente `church`.

Fase 5 permanece **parcial quanto ao gate**: o complemento implementa paginação,
vínculo cadastral e demais fundamentos locais, mas a validação integrada,
PostgreSQL/CI e dispositivos ainda não foram concluídos. Nenhum domínio novo da
Fase 6 foi implementado nesta rodada.
