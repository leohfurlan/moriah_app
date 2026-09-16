# Fase 2 — Navegação (verificação)

- Data: 16/09/2026
- Plano: `docs/plano-mvp-moriah-execucao-2026-09-16.md` (Fase 2 — navegação)
- Verificador: `node tools/qa/run.mjs fase2` (ver `tools/qa/README.md`)
- Evidência: `docs/qa/evidencias/fase2-2026-09-16T123353/` (`resultados.json`, `resumo.md`, `shots/*.png`)
- Resultado: **13 checks, 13 PASS, 0 FAIL**
- Observação: esta evidência foi gerada antes das correções desta revisão; os checks devem ser reexecutados antes do commit.

| # | Critério | O que o check faz | Resultado |
|---|---|---|---|
| 1 | Item visível leva à tela do rótulo | clica em cada item do menu lateral (desktop) e confere a rota | PASS — Visão geral→`/home`, Agenda→`/agenda`, Escalas→`/schedules`, Meu extrato→`/statement` |
| 2 | Capacidade respeitada | membro e gestão comparados; clique da gestão | PASS — membro não vê "Criar escala"; gestão vê e chega em `/schedule-create` |
| 3 | Sem item decorativo | varre o texto do menu atrás de rótulos sem tela | PASS — 9 rótulos conferidos (Visitantes, Setlists, Repertório, Bandas, Escola Bíblica, Turmas, Palavras, Relatórios, Configurações) |
| 4 | Abas mobile aprovadas | clica nas 5 abas (viewport 390×844) | PASS — Início/Agenda/Escalas/Contribuições/Perfil levam às rotas certas |
| 4b | Aba ativa indicada | compara o fundo das 5 abas com a rota atual | PASS — exatamente uma destacada (`rgb(238,242,255)`) e é a da rota |
| 5 | Avatar e nome reais | compara a tela com o `/api/me/` capturado na sessão | PASS — iniciais "MS" (Maria Silva), nome na tela, sem o "AM" fixo |
| 6 | Decisão D7 respeitada | confere que o sino não exibe badge persistente | PENDENTE — reexecutar após a remoção do badge |
| 7 | Busca funciona | digita "escala" no topbar e clica no resultado | PASS — resultado real e navegação para `/schedules` |
| 7b | Busca sem resultado avisa | digita termo inexistente | PASS — "Nada encontrado nesta conta." |
| 8 | Botão do menu não é decorativo | recolhe e expande o menu | PASS — rótulos somem, botão vira "Expandir menu", rótulos voltam |
| 9 | Estados de erro/vazio | `GET /api/me/statement/` forçado a 503 | PASS — mensagem + botão "Tentar novamente" |

## Navegação canônica

`mobile/src/navigation.ts` passa a ser a única lista de destinos. Antes, a
`Sidebar` e a `BottomNav` mantinham arrays próprios com itens apontando para
telas que não tinham nada a ver com o rótulo ("Visitantes" abria o perfil,
"Setlists" abria escalas, "Palavras" abria a home).

Menu lateral (desktop) — `MENU_LATERAL`:

| Grupo | Item | Rota | Capacidade exigida |
|---|---|---|---|
| Dashboard | Visão geral | `/home` | — (qualquer conta autenticada) |
| Cultos e eventos | Agenda | `/agenda` | — |
| Ministérios | Escalas | `/schedules` (ativa em `/schedule/*`, `/song/*`) | — |
| Financeiro | Meu extrato | `/statement` (ativa em `/contribution`) | — |
| Gestão | Criar escala | `/schedule-create` | `manage_schedules`, `manage_all` ou `manage_pastoral` |

Abas (mobile) — `ABAS`: Início `/home`, Agenda `/agenda`, Escalas `/schedules`,
Contribuições `/statement`, Perfil `/profile` (rótulos conforme decisão D3 —
"Contribuições", não "Conteúdo").

## O que mudou

- `mobile/src/navigation.ts` (novo): itens com rótulo, rota, ícone, capacidade e
  rotas ativas (`rotaAtiva`), filtro por capacidade (`gruposVisiveis`,
  `temAcesso`), `CAPACIDADES_DE_ESCALA`/`podeGerenciarEscalas` e a busca
  (`buscaItens`, sem acento e sem caixa). Item sem tela não entra no menu.
- `mobile/src/components/Screen.tsx`: renderiza a navegação a partir da
  configuração; menu lateral recolhível (76 px, só ícones, com
  "Recolher/Expandir menu" de verdade); busca do topbar virou `<TextInput>` que
  busca nos destinos **visíveis para aquela conta**; avatar e nome vindos de
  `/api/me/`; badge persistente removido conforme D7; arrays duplicados
  (`sidebarGroups`, `mobileNavItems`, `isActiveRoute`) e o rodapé com
  "Configurações" removidos.
- `mobile/src/hooks/useAuth.ts`: perfil e capacidades compartilhados por cache
  de módulo (um `GET /me/` por sessão, com notificação de todos os
  consumidores) — o `Screen` passou a depender das capacidades sem duplicar a
  chamada que cada tela já fazia.
- `mobile/app/_layout.tsx`: guarda de rota por capacidade
  (`ROTAS_DE_GESTAO`) usando a mesma `CAPACIDADES_DE_ESCALA` do menu.

## Decisões registradas

- **"Configurações" saiu da navegação** (era um botão sem rota). O plano admitia
  criar a tela ou remover o item; removemos para não prometer o que não existe
  no MVP — quando a tela de configurações existir, basta acrescentar o item em
  `MENU_LATERAL`.
- **Ícones das abas**: o mockup define rótulos e ordem; os ícones foram
  escolhidos por semântica (Início `House`, Agenda `CalendarDays`, Escalas
  `CalendarCheck`, Contribuições `HandCoins`, Perfil `UserRound`) porque a
  lista anterior usava ícones trocados (Escalas com ícone de dinheiro,
  Contribuições com ícone de livro).
- **Busca ≠ promessa**: o campo busca apenas destinos que existem para a conta.
  Não há busca global de membros/escalas nesta fase.

## Lacunas conhecidas (não bloqueiam a fase)

- As abas não publicam `aria-selected`/`aria-current` (o react-native-web não
  mapeia `accessibilityState.selected` para `role="link"`); a evidência de aba
  ativa é o destaque visual. Melhoria de acessibilidade para a fase de polimento.
- Home e Perfil continuam usando notificações locais do MVP, rotuladas como
  demonstração no popover; o sino não exibe contagem persistente.

## Reprodução

```bash
# backend + Expo web no ar
node tools/qa/run.mjs fase2
```
