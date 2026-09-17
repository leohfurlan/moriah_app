# Relatório de implementações — estabilização do MVP

**Data:** 17/09/2026

**Branch da entrega:** `codex/moriah-navigation-admin`

**Base anterior à entrega:** `402b3c2fd64c035c59a6f5af83ab7d3356a186c7`

**Escopo:** correções apontadas na revisão das fases 1–5, com foco em escalas,
extrato, notificações, isolamento e contrato de navegação.

## 1. Resumo executivo

As falhas P1 do ciclo de escalas foram corrigidas e protegidas por testes de
regressão. Membros não conseguem consultar nem responder escalas em rascunho,
e a confirmação agora usa a mesma regra de conflito aplicada na montagem da
equipe, incluindo compromissos pessoais.

Também foram removidos dados fictícios do extrato desktop, corrigido o contador
de análise, habilitada a alteração de resposta da escala, corrigida a auditoria
de cancelamento e implementado o primeiro fluxo persistente de notificações.
A rodada corretiva pós-revisão acrescentou atomicidade, sincronização do sino,
feedback/retry de notificações e correções de gráfico/datas. A Fase 5 permanece
parcial; não há entrega de domínio novo da Fase 6 nem autorização de deploy.

## 2. Implementações realizadas

### 2.1 Escalas e conflitos

- `GET /api/me/schedules/{id}/` restringe membros a escalas publicadas.
- `POST /api/me/schedules/{id}/action/` rejeita respostas para rascunhos e
  canceladas com `409`.
- A confirmação recalcula conflitos por meio de `services.conflict_reason()`.
- Conflitos agora incluem:
  - outra escala ativa no mesmo horário;
  - compromisso pessoal planejado sobreposto.
- Ao confirmar uma escala sem conflito, `conflict_reason` é limpo.
- O `409` de conflito preserva os campos da participação e inclui `detail` com o
  motivo e `code=schedule_conflict`; o schema documenta essa resposta. A lista
  pessoal e o detalhe recarregam o estado antes de apresentar o erro.
- Publicação e inclusão em escala publicada agora mantêm estado, notificações e
  auditoria na mesma transação. A substituição preserva a transação existente.
  Publicação, inclusão, substituição e cancelamento bloqueiam somente a linha
  da escala (`select_for_update(of=("self",))`), sem JOINs opcionais no lock.
  Testes injetam falhas e confirmam rollback e nova tentativa sem aviso perdido.
- A tela de detalhe permite alterar a resposta depois de confirmar, recusar ou
  marcar indisponibilidade, enquanto a escala não estiver cancelada.
- Atalhos de gestão usam `manage_schedules`, alinhado à permissão do backend;
  tesouraria, secretaria e outras capacidades administrativas não recebem
  ações de escala indevidas.

### 2.2 Auditoria e isolamento

- Cancelamento grava o status anterior real (`draft` ou `published`), sem valor
  fixo.
- Consultas de células filtram explicitamente a igreja da conta tanto na
  listagem quanto na criação de reuniões.
- A exclusão de integrante de escala recebeu contrato explícito no OpenAPI,
  eliminando o erro único de introspecção do schema.

### 2.3 Extrato

- O contador “Em análise” usa os estados reais do backend: `pending` e
  `needs_review`.
- O gráfico mensal deixou de usar alturas e meses fixos; os valores são
  calculados a partir das contribuições carregadas.
- Meses zerados têm altura zero, sem `minHeight` ou mínimo artificial. Valores
  positivos seguem proporção linear, com valor numérico e rótulo acessível.
- Datas `AAAA-MM-DD` são civis locais, sem conversão implícita de UTC. As janelas
  de 3/6 meses e um ano usam corte inclusivo à meia-noite e ajustam limites de
  fim de mês/ano bissexto (filtros da tela desktop, não abas mobile).
- Sem dados no período, a interface mostra estado vazio em vez de gráfico de
  demonstração.
- Filtros desktop de período, categoria e status agora alteram totais, gráfico
  e tabela.
- `GET /api/me/statement/` aceita `status`, `category`, `date_from` e `date_to`,
  com validação de valores e datas.

### 2.4 Notificações persistentes

Foi criado o modelo `Notification`, com escopo por igreja e destinatário,
deduplicação por evento, `read_at` e índices para consulta de não lidas.

Endpoints adicionados:

- `GET /api/me/notifications/`
- `GET /api/me/notifications/{id}/`
- `POST /api/me/notifications/{id}/read/`
- `POST /api/me/notifications/mark-all-read/`
- `GET /api/me/notifications/unread-count/`

Eventos que geram notificações:

- publicação de escala;
- inclusão ou substituição de integrante em escala já publicada;
- aprovação ou rejeição de contribuição.

O mobile deixou de consumir `MVP_NOTIFICATIONS` e passou a carregar os dados da
API. O sino desktop consulta `/me/notifications/unread-count/`. Um store único,
isolado por conta, alimenta sino, lista e detalhe; leituras individuais e em lote
recarregam lista/contador após persistência, sem sucesso otimista em POST falho.
Abrir o sino e entrar na lista força nova consulta. Logout/sessão expirada limpam
o cache; respostas antigas não repopulam dados da conta anterior.

Lista e detalhe têm carregamento, falha com retry e vazio/404 distintos. Falha
ao persistir leitura fica visível com nova tentativa, inclusive no detalhe;
não é descartada silenciosamente. Persistência e isolamento são verificados
na API real em banco de teste; sincronização visual é verificada com API simulada.

### 2.5 Navegação e documentação

- Conteúdo foi removido da sidebar e das abas, pois ainda não possui modelo,
  permissões ou fluxo de publicação.
- A rota direta de Conteúdo informa que o domínio está fora do MVP.
- As decisões e o inventário de navegação foram atualizados para refletir o
  estado persistente das notificações e o isolamento das células.
- O inventário separa o baseline histórico do working tree atual: 19 arquivos
  de rota (17 rotas + layout + fallback), guardas, gestão financeira/escalas e API
  de ministérios existentes. Mantida a leitura administrativa da própria igreja.
- Navegação mobile real: Início, Agenda, ação central Nova contribuição e Perfil.
  Escalas é acessível pela Agenda; extrato pelo Perfil. Não são cinco abas.
- QA da fase 2 confere esse contrato, aceita `/api`, `/backend` e `/local-api` e
  valida o badge específico contra o contador real; não lê `MVP_NOTIFICATIONS`.

## 3. Testes e validações

| Validação | Resultado |
|---|---:|
| Suíte completa do backend (SQLite em memória) | **131 passed, 3 warnings de depreciação** |
| Suíte focada de escalas, financeiro e notificações | **87 passed** |
| `python manage.py check` | **PASS** |
| `python manage.py makemigrations --check --dry-run` | **PASS — No changes detected** |
| `python manage.py spectacular --validate` | **PASS — 0 erros, 9 warnings existentes** |
| `npm run typecheck` em `mobile/` | **PASS** |
| `npm test` em `mobile/` (módulos reais, sem navegador) | **10 passed** |
| QA focado `node tools/qa/run.mjs fase5` (API simulada, Chromium) | **12 PASS / 0 FAIL** |
| `git diff --check` | **PASS** |

Novos testes cobrem:

- acesso e resposta indevidos em escala `draft`;
- confirmação com compromisso pessoal sobreposto;
- status anterior real no cancelamento;
- notificação de publicação de escala;
- notificação de revisão financeira;
- contador e persistência de leitura de notificações.
- rollback de publicação após entrega parcial e retry idempotente;
- rollback de inclusão e substituição após falha de entrega/auditoria;
- isolamento de leitura individual/lote por destinatário e igreja;
- sincronização de badge, falha de POST, limpeza no logout e respostas atrasadas;
- data civil, dia limite inclusivo, fim de mês/bissexto e proporção/zero do gráfico;
- feedback de servidor, 404 e retry; atualização da UI após conflito `409`.

Comandos executados no backend: `python -m pytest -q -p no:cacheprovider`, suíte
focada de `apps/schedules/tests apps/finance/tests apps/audit/tests/test_notifications.py`
e comandos Django com `DJANGO_SETTINGS_MODULE=config.settings_test`.
No mobile: `npm test` com `TZ=America/Sao_Paulo` e `npm run typecheck`.
O QA focado usou Expo local e `QA_BASE=http://127.0.0.1:8085`, sem backend/seed;
as evidências são regeneráveis em `output/playwright/fase5-<carimbo>/`.
Última execução aprovada: `output/playwright/fase5-2026-09-17T150520/`, com
`resultados.json`, `resumo.md` e screenshots desktop/mobile; artefatos ignorados
pelo Git. A skill Playwright orientou a validação focada e a captura de evidências.

O CI foi ampliado para executar regressões do front e testes operacionais
PostgreSQL (financeiro, escalas, auditoria). **CI e PostgreSQL não foram executados
nesta rodada**. As fases QA 1–4 completas também não foram reexecutadas.

## 4. Arquivos centrais

- `backend/apps/schedules/views.py`
- `backend/apps/schedules/tests/test_operational_flows.py`
- `backend/apps/finance/views.py`
- `backend/apps/audit/models.py`
- `backend/apps/audit/notification_service.py`
- `backend/apps/audit/notification_views.py`
- `backend/apps/audit/migrations/0002_notification.py`
- `backend/apps/audit/tests/test_notifications.py`
- `mobile/src/screens/StatementScreen.tsx`
- `mobile/src/screens/NotificationsScreen.tsx`
- `mobile/src/screens/NotificationDetailScreen.tsx`
- `mobile/src/components/Screen.tsx`
- `mobile/src/screens/SchedulesScreen.tsx`
- `mobile/src/hooks/useNotifications.ts`
- `mobile/src/services/notificationStore.ts`
- `mobile/src/services/dates.ts`
- `mobile/src/hooks/useAuth.ts`, `mobile/src/services/errors.ts`, `mobile/src/theme.ts`
- `tools/qa/checks/fase2.mjs`, `tools/qa/checks/fase5.mjs`
- `tools/qa/tests/mobile-regressions.cjs`, `tools/qa/run.mjs`, `tools/qa/README.md`
- `mobile/package.json`, `.github/workflows/ci.yml`

## 5. Pendências não incluídas nesta rodada

- Paginação geral de listas com navegação entre páginas.
- Fluxo seguro para solicitar vínculo de uma conta sem `member_profile`.
- Recuperação/troca de senha e invalidação server-side do logout.
- Demais atividades da Fase 5 não comprovadas: pickers em todos os formulários,
  filtros/paginação em todas as listas, normalização completa de mensagens/estilo
  e remoção de requisições anônimas no boot. Não confundir filtros locais do
  extrato desktop com conclusão transversal desses itens.
- QA visual completo, testes PostgreSQL dedicados e validação em dispositivos
  Android/iOS.
- Deploy ou aplicação da migration em ambiente externo.

## 6. Estado de entrega

A implementação foi validada localmente e o usuário autorizou commit, push e
abertura do PR deste material. O working tree já continha alterações anteriores
do usuário; as alterações de implementação foram preservadas e incluídas no
escopo. Anexos da conversa e evidências regeneráveis não fazem parte do commit.
Publicação no Git não implica merge, deploy nem aplicação de migration externa.

## 7. Gate para a Fase 6

**Ainda não fechado.** Esta rodada estabiliza a base, mas não declara todos os
fundamentos da Fase 5 concluídos. Antes de liberar formalmente a implementação
dos domínios novos, resolver ou adiar explicitamente as pendências da seção 5,
confirmar o CI com PostgreSQL e completar o QA integrado dos papéis e fluxos.

O planejamento/modelagem da Fase 6 pode começar em paralelo. Cada novo domínio
deve ter permissões, contrato de API, critérios de aceite e uma fatia vertical
completa; a existência de commit/PR não substitui esses critérios nem o gate.
