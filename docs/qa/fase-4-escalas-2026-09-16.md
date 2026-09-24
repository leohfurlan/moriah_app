# Fase 4 — Gestão de escalas (verificação)

- Data: 16/09/2026
- Plano: `docs/plano-mvp-moriah-execucao-2026-09-16.md` (Fase 4 — escalas; seções 9.1–9.3 e o critério de aceite)
- Verificador: `node tools/qa/run.mjs fase4` (ver `tools/qa/README.md`)
- Evidência: `docs/qa/evidencias/fase4-2026-09-16T144807/` (`resultados.json`, `resumo.md`, `shots/*.png`) — mesma execução reproduzida em `.../fase4-2026-09-16T144200/`
- Resultado: **12 checks, 12 PASS, 0 FAIL** (2 de preparo + 10 de aceite), com `pytest` 110 passed e `npx tsc --noEmit` sem erro na mesma rodada

| # | Critério | O que o check faz | Resultado |
|---|---|---|---|
| 1 | Guarda de rota | membro (sem `manage_schedules`) abre `/schedule-admin` digitando a URL | PASS — vê "Acesso restrito" com explicação em PT-BR e **não** aparece a lista administrativa |
| 2 | Lista de gestão | coordenação abre `/schedule-admin` | PASS — vê as escalas do ministério que coordena ("Escala Principal" publicada, "Escala do Ensaio" rascunho), selos de situação, contagem e o caminho para criar |
| 3 | Criar escala | preenche o formulário (nome, evento, data BR, local, ministério) e clica "Salvar como rascunho" | PASS — `POST /api/schedules/` 201 com `ministry_id` no corpo, status `draft`, aparece na lista **e o evento entra em `/api/me/events/`** |
| 4 | Detalhe/gestão | abre a escala publicada pela lista | PASS — 5 integrantes na fonte, todos na tela, 5/5 situações (`status_display` do backend), histórico Lucas Dias → Renata Lopes e a contagem da equipe |
| 5 | Formar equipe | abre "Adicionar integrante", escolhe função e candidato, confirma | PASS — `POST /api/schedules/30/assignments/` 201 (`{"member_id":1,"ministry_role_id":1}`) e o integrante entra na equipe |
| 6 | Publicar → membro vê | publica pela gestão e abre `/schedules` na conta do membro | PASS — selo "Publicada" e a escala aparece para quem foi escalado (ponta a ponta) |
| 6b | Membro responde | membro abre o detalhe da escala e confirma presença | PASS — tela mostra "Confirmado" e a gestão lê `status: confirmed` na equipe |
| 7 | Cancelar → membro deixa de ver | cancela pela gestão e volta na conta do membro | PASS — selo "Cancelada" e a escala sai da visão do membro |
| 2b | Preparo | logins de membro e coordenação pela tela real | PASS |

## Critério de aceite do plano

> "Um administrador consegue criar uma escala completa, selecionar pessoas, publicar e acompanhar as respostas. Um membro consegue visualizar e responder sem acessar dados de outra igreja."

- **Criar** → check 3 (nasce rascunho, com ministério).
- **Selecionar pessoas** → check 5 (função + candidato, com conflito de agenda visível).
- **Publicar** → check 6 (e o membro passa a ver).
- **Acompanhar as respostas** → check 6b (a gestão lê o status confirmado) + contagem por situação no detalhe (check 4).
- **Sem acessar dados de outra igreja / de outro ministério** → check 1 (guarda de rota) + escopo por ministério na API (coordenador só vê o que coordena; validado também na verificação de API abaixo).

## Verificação de API (ad-hoc, camada HTTP)

Além da interface, o contrato HTTP foi exercitado direto contra a API
(`http://localhost:8000`) com a conta de coordenação: **30 verificações, 0 falhas** —
criação nasce rascunho e guarda o ministério; publicar sem integrante dá 400;
integrante repetido dá 409; **conflito de agenda** aparece como `available=false`
com motivo e grava `status=conflict` ao escalar; publicar é idempotente (não
reescreve `published_at`); cancelar é idempotente, bloqueia republicação (400) e
some da visão do membro; membro recebe 403 na gestão e no detalhe administrativo.

## O que foi implementado

Backend (`backend/`):

- `apps/schedules/models.py`: FK `ministry` na escala + migração `0005_schedule_ministry`.
- `apps/schedules/services.py` (novo): regras de escopo, conflito e ciclo de vida em um só lugar.
- `apps/ministries/{services,serializers,views}.py` (novos): escopo compartilhado (`can_manage_ministry`/`managed_ministries`) e `GET /api/ministries/`.
- `apps/schedules/serializers.py`, `views.py`: contrato de gestão (lista, detalhe, criar, editar, publicar, cancelar, candidatos, integrantes, substituir).
- `apps/schedules/views.py`: ações com auditoria (`created`, `published`, `cancelled`, `assignment_added`, `assignment_removed`, `substitution`) e 409 na remoção com substituição vinculada.
- `apps/schedules/tests/test_schedule_admin.py` (novo, 13 testes) + `test_schedule_create.py` ajustado à regra de escopo.

Seed (`backend/apps/accounts/management/commands/seed_mvp.py`): contas de gestão
(secretaria, coordenação de louvor, pastor), ministério Recepção, 6 funções, 4
candidatos ativos, escala em rascunho ("Escala do Ensaio") e uma substituição
registrada ("Escala Principal": Lucas Dias → Renata Lopes).

App (`mobile/`):

- `src/screens/ScheduleAdminScreen.tsx` (novo): lista de gestão com filtros por situação.
- `src/screens/ScheduleAdminDetailScreen.tsx` (novo): equipe com função/situação/contato, contagem, publicar, cancelar, editar (PATCH), adicionar integrante com candidatos e aviso de conflito, substituir, remover e histórico de substituições.
- `app/schedule-admin.tsx` e `app/schedule-admin/[id].tsx`: rotas.
- `app/_layout.tsx`: guarda por capacidade para `/schedule-admin*` que **mostra o aviso na própria página** (não redireciona para uma tela que ainda exibiria dados de escala).
- `src/screens/ScheduleCreateScreen.tsx`: escolha de ministério obrigatória, data em `DD/MM/AAAA HH:mm` (convertida para ISO), "Salvar como rascunho" (padrão) e "Publicar agora".
- `src/screens/SchedulesScreen.tsx`: atalho "Gerenciar escalas" só para quem opera escalas e o nome da escala na participação do membro.
- `src/services/api.ts` (`patch`, `delete`), `src/types/api.ts` (tipos da fase), `src/navigation.ts` (item "Gestão de escalas"), `src/theme.ts` (rótulo da rota).

Verificação (`tools/qa/`):

- `checks/fase4.mjs` (novo): os 10 critérios acima, com prova pela API (`escalaDaApi`, `detalheDaApi`, `eventoNaAgenda`, `escalaDoMembroDaApi`) além do que a tela mostra.
- `lib/harness.mjs`: o status das requisições de escrita passou a ser fechado pelo evento de resposta (antes o registro ficava "sem status" por corrida e um check podia concluir "o clique não chegou na API" com a escala já criada).
- `checks/fase1.mjs`: os checks 3 e 4 foram atualizados para o fluxo novo de criação (ver abaixo).

## Mudanças de contrato assumidas

1. **Criar escala nasce rascunho** (plano, seção 9.1). O formulário não publica
   mais direto: ganhou "Salvar como rascunho" (padrão) e "Publicar agora", e o
   destino após salvar é a tela da escala criada (`/schedule-admin/<id>`), onde a
   equipe é montada. Isso alterou dois checks da fase 1, que passaram a exigir a
   confirmação visível + destino na gestão da escala, e o evento continua sendo
   criado na agenda da igreja (agora verificado pela API no check 3 da fase 4).
2. **Guarda de rota que explica em vez de redirecionar**: quem não coordena vê o
   aviso em PT-BR na própria `/schedule-admin`; a lista administrativa nunca
   chega a aparecer.
3. **Situação do integrante vem do backend** (`status_display`), sem dicionário
   de rótulos duplicado no app.

## Como rodar

```bash
# backend no ar (docker compose up) e Expo web em http://localhost:8081
node tools/qa/run.mjs fase4        # gestão de escalas
node tools/qa/run.mjs fase1        # regressão de confiabilidade
```

Limpeza dos dados de teste (escalas/eventos criados pelos checks ficam no banco
de desenvolvimento): `docker compose exec -T backend python manage.py shell < tmp/limpa_verificacao.py`.

## Falhas conhecidas fora do escopo desta fase

- **fase 2, check 3** (`sobraram: Escola Bíblica`): "Escola Bíblica" é um **evento
  do seed** que a home do membro exibe; o check varre o texto da página inteira
  em busca de rótulos decorativos de menu, então depende de a lista de eventos já
  ter carregado (passou em uma execução e falhou em outra — comportamento
  instável). Não tem relação com escalas.
- **fase 2, check 6** (badge do sino `14` × `3` notificações): o relatório da
  fase 2 já registrava esse check como pendente; a contagem do sino e a lista de
  notificações estão sendo alteradas em paralelo, fora desta fase.

Ambas ficam em `mobile/src/components/Screen.tsx` / home / notificações, que esta
fase não tocou (o `git diff` de `HomeScreen.tsx` e `notifications.ts` está vazio).

## Observação de contexto

Durante esta fase havia um segundo agente escrevendo no mesmo working tree
(finanças/fase 3, inclusive `mobile/app/finance-review.tsx` e o `run.mjs`). Uma
execução intermediária de `node tools/qa/run.mjs todas` rodou em paralelo com a
dele e produziu falhas por colisão no banco de demonstração (dois processos
criando escalas para a mesma pessoa no mesmo horário). Os resultados acima são de
execuções **isoladas**, com a limpeza do banco entre elas.

---

## Revisão dos seis problemas — 16/09/2026

A revisão corrigiu os seis problemas apontados. As alterações desta rodada foram
aplicadas sobre o working tree existente, sem descartar mudanças anteriores.

### Ajustes realizados

- Publicação: publication_error centraliza o bloqueio de escala vazia; a criação com status=published sem equipe retorna 400 antes de criar evento/escala. A ação antes chamada “Publicar agora” salva o rascunho e leva à montagem da equipe; a publicação fica na tela de gestão.
- Resposta cancelada: confirmar, recusar e marcar indisponibilidade retornam 409 e não alteram o integrante quando a escala está cancelada.
- Conflito: escalas canceladas são excluídas da consulta de sobreposição; escalas ativas continuam gerando conflito.
- Substituição na UI: o painel inicia com a função do integrante original.
- Resposta em conflito: conflict exibe o motivo e mantém as respostas válidas; cancelled, declined, unavailable, replacement_needed e confirmed têm mensagens próprias.
- Validação de substituição: o endpoint reutiliza resolve_assignment_target, validando membro, igreja, função e ministério antes de criar a substituição ou alterar o original.

### Execuções realizadas

| Validação | Resultado |
|---|---|
| python -m pytest -q apps/schedules/tests | 45 passed, 3 warnings |
| python -m pytest -q | 119 passed, 3 warnings |
| npx tsc --noEmit em mobile/ | PASS |
| git diff --check | PASS |
| node tools/qa/run.mjs fase4 em desktop | 11 PASS, 0 FAIL; evidência docs/qa/evidencias/fase4-2026-09-16T170320/ |
| Smoke real em viewport mobile 390x844 | PASS: criação sem publicação vazia, função original na substituição, ações de conflict e bloqueio de ações em escala cancelada |

Os testes backend usam config.settings_test com SQLite em memória. O QA de
interface escreveu somente dados com prefixo de verificação no banco local; a
limpeza foi executada em finally, retornou código 0 e deixou apenas as escalas
do seed (Escala Principal e Escala do Ensaio). Uma tentativa intermediária em
uma instância Expo isolada falhou no login antes do fluxo; não foi usada como
resultado de aceite e foi seguida pela execução final aprovada acima.

### Leitura de código e pendências

A leitura dos documentos de referência e dos arquivos afetados foi realizada.
Não há pendência conhecida entre os seis problemas desta revisão. Permanecem
fora deste escopo as pendências já registradas para outras fases (por exemplo,
notificações persistentes e itens da fase 2).

A branch criada para o trabalho é codex/fase-4-correcoes. Nenhum commit, push
ou deploy foi realizado, conforme a instrução final da solicitação.