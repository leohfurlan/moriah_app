# Relatório de paridade — App Moriah × Mockup canônico

**Data:** 16/09/2026
**Escopo:** comparar o mockup canônico (`design/moriah_next.pen`) com o que está de fato implementado em `mobile/` (app Expo/React Native) e `backend/` (Django REST), identificar o que está **implementado**, o que está **pendente** e o que precisa ser **corrigido em rotas e processos**.
**Método:** leitura do JSON do mockup + inspeção de código + QA exploratório automatizado no app rodando (`http://localhost:8081`) com captura de rede, console e evidência visual. Nada neste relatório é estimativa: cada afirmação tem arquivo, linha ou execução por trás (ver §10).

---

> **Errata de 16/09/2026 (Fase 0).** Quatro métricas deste relatório foram conferidas contra o
> código e corrigidas:
> (1) "24 endpoints" → **24 operações em 19 caminhos** do schema OpenAPI;
> (2) "sidebar promete 19 destinos" → **16 itens em 8 grupos, mais `Configurações` sem rota**;
> (3) "8 dos 16 itens apontam para a tela errada" → **13 dos 16** (3 levam à tela certa:
> `Dashboard > Visão geral`, `Escalas`, `Agenda`);
> (4) o mapa da sidebar está em `Screen.tsx:49-96`, não `:56-70`.
> Detalhamento e tabela item a item em `docs/architecture/navegacao-mvp.md` §1-2.
> As demais métricas (49 frames, 12 telas, 13 arquivos de rota, 67 testes, 41,5 %) foram
> reconferidas em 16/09/2026 e estão corretas — ver `docs/qa/baseline-2026-09-16.md`.

## 1. Sumário executivo

| Métrica | Mockup | Implementado no app | Cobertura |
|---|---:|---:|---:|
| Telas (frames) | **49** (23 desktop 1440×1024 + 26 mobile 390×844) | **12 telas** em `mobile/src/screens` + shell desktop | 8 telas do mockup têm tela equivalente |
| Rotas (Expo Router) | — | **13 arquivos em `mobile/app`** (12 rotas + `_layout.tsx`) | 5 rotas internas + 6 telas de membro + 1 dinâmica |
| Endpoints de API do mockup-equivalentes | — | **24 operações em 19 caminhos** (67 testes passando) | 13 consumidos pelo app; **6 escrevem estado**; 4 recursos sem UI |
| Aderência de conteúdo (mobile, proxy textual) | 241 strings nas 9 telas com rota | 100 strings presentes | **41,5 %** |
| Aderência de conteúdo (desktop, proxy textual) | 8 telas com rota | ver §3.1 | **38–70 %** por tela |

**As cinco conclusões que importam**

1. **O app é a versão "5 telas + login" do mockup.** Existem hoje 12 telas; o mockup pede 49. **15 telas desktop e 16 mobile** simplesmente não têm rota — incluindo blocos inteiros do produto (Gestão financeira/aprovação, Escola Bíblica/turmas, Repertório, Bandas/equipes, Setlists, Palavras, Diretório, Família, Privacidade, Ajuda).
2. **A sidebar desktop promete 16 itens e entrega 5 destinos.** Dos 16 itens com rota, só 3 levam à tela que o rótulo promete (`Dashboard > Visão geral`, `Escalas`, `Agenda`); **13 apontam para a tela *errada*** (ex.: `Membros`→Meu Perfil, `Setlists`→Minhas escalas, `Escola Bíblica`→Agenda, `Palavras`→Dashboard, `Financeiro > Contribuições`→extrato pessoal) e `Configurações` não faz nada. O campo "Buscar no Moriah" não é um input (a home tem **zero** elementos `input`). Isso é fachada: induz o gestor ao erro.
3. **Nenhum feedback de erro/sucesso aparece na build web/desktop.** `Alert.alert` é *no-op* no React Native Web (implementação vazia em `react-native-web/dist/exports/Alert/index.js`) e o app tem **14 chamadas de `Alert.alert` em 8 telas**. Consequência verificada ao vivo: o membro que tenta criar escala recebe **403 e não vê nada**; o admin que cria escala recebe **201 e não é levado à agenda** (o `router.replace` está no callback do Alert, que nunca roda); login com senha errada não mostra erro nenhum. Praticamente todo o tratamento de erro do produto é invisível no desktop.
4. **O dashboard desktop exibe dados fictícios fixos.** `Membros ativos 248`, `+8 este mês`, `Próximos cultos 6`, gráfico de barras fixo `[52,78,64,92,70,86]`, listas "Próximos cultos e eventos", "Próximas escalas" e "Atividades recentes" hardcoded — e `Contribuições no mês` cai em `R$ 12.450` fixo quando a pessoa não tem contribuição (é exatamente o caso da tesouraria). Um número falso de arrecadação na tela do financeiro é risco operacional, não detalhe estético.
5. **O backend é mais capaz que o app.** Já existem endpoints de **revisão de contribuição** (`/api/contributions/{id}/review/` — aprovar/rejeitar, o coração da tela "Gestão financeira"), **publicação de escala** (`/api/schedules/{id}/publish/`), **substituição** (`.../assignments/{id}/substitute/`) e **células** (`/api/cell-meetings/`, `/api/leader/cell-members/`) — todos sem nenhuma UI. O gargalo do MVP hoje é front + rotas, não domínio.

---

## 2. Método e evidências

- **Mockup:** parsing direto do JSON do Pen.dev (`version 2.17`, 49 frames, 7002 nós, 2904 nós de texto, 16 tokens). Inventário completo em `output/design-review/mockup-inventario.md` (872 KB) e `output/design-review/mockup-tokens.md`.
- **Backend:** leitura de `config/urls.py` + `views.py`/`serializers.py`/`permissions.py` por app, com `python -m pytest -q` executado (67 passed, 0 failed). Inventário em `output/design-review/backend-inventario.md`.
- **App ao vivo:** QA automatizado com Playwright/Chromium sobre o Expo Web (`localhost:8081`, API em `http://192.168.24.6:8000`):
  - `tmp/qa-walkthrough.mjs` → varredura de 16 rotas × 4 papéis × 2 viewports (`output/design-review/qa-sweep.json`, 61+ screenshots em `output/design-review/shots/`).
  - `tmp/qa-flows2.mjs` → fluxos de escrita com captura de rede (`output/design-review/qa-flows2.json`, `output/design-review/flow*/`).
  - `tmp/qa-diag2.mjs` → reprodução instrumentada (request/response/diálogo por passo) dos cliques em formulário.
  - Captura de console, `pageerror` e respostas HTTP ≥ 400 em todos os passos.
- **Código:** leitura de `mobile/src/**` e `mobile/app/**` (3.741 linhas de TypeScript, `wc -l`) e verificação da implementação de `Alert` no `react-native-web` instalado.
- **Higiene:** os artefatos criados durante o teste (2 eventos, 2 escalas, 3 compromissos, 3 requisições cadastrais, 1 contribuição) foram **removidos do banco** ao final; o seed ficou no estado original (3 eventos, 1 escala, 13 contribuições).

**Limitações honestas:** (a) a comparação por texto é um *proxy* de paridade — mede presença de rótulos/valores, não pixel; `vision_analyze` estava indisponível (chave de API inválida), então não houve diff visual automático; (b) as telas desktop foram exercitadas em viewport 1440×1024 e as mobile em 390×844; (c) o app foi testado na *build web* (Expo Web) — no app nativo, `Alert` **funciona**, o que significa que hoje **desktop/web e mobile têm comportamento diferente** para erro e sucesso.

---

## 3. Cobertura tela a tela

### 3.1 Desktop — 23 telas do mockup

| # | Tela do mockup | Rota no app | Status | Textos do mockup presentes / total |
|---|---|---|---|---|
| 01 | Dashboard geral | `/home` | Parcial (dados fictícios) | 41/76 |
| 02 | Minhas contribuições | `/statement` | Parcial | 43/87 |
| 03 | Registrar contribuição | `/contribution` | Bom | 30/49 |
| 04 | Gestão financeira (tesouraria) | — | **Ausente** | 0/98 |
| 05 | Detalhe de contribuição (aprovar/rejeitar) | — | **Ausente** (endpoint existe) | 0/57 |
| 06 | Escola Bíblica | — | **Ausente** | 0/69 |
| 07 | Detalhe da turma | — | **Ausente** | 0/77 |
| 08 | Escalas dos ministérios | `/schedules` | Parcial (sem gestão real) | 33/70 |
| 09 | Criar escala | `/schedule-create` | Mínimo (5 campos, sem equipe) | 30/79 |
| 10 | Agenda de cultos | `/agenda` | Bom | 60/85 |
| 11 | Detalhes do culto | — | **Ausente** | 0/73 |
| 12 | Perfil do membro | `/profile` | Parcial | 31/82 |
| 13 | Palavras | — | **Ausente** | 0/88 |
| 14 | Setlist do culto — Adicionar música | — | **Ausente** | 0/120 |
| 15 | Repertório da igreja | — | **Ausente** | 0/102 |
| 16 | Bandas de louvor | — | **Ausente** | 0/100 |
| 17 | Detalhe da equipe | — | **Ausente** | 0/106 |
| 18 | Música da escala | `/song/[id]` | Quebrado por link direto (§5.2) | 0/82 |
| 19 | Setlist do culto | — | **Ausente** | 0/120 |
| 46–49 | 4 estados do dashboard (sidebar recolhida, busca global, notificações, menu de perfil) | — | **Ausentes** (notificações/busca/menu existem só como casca) | — |

### 3.2 Mobile — 26 telas do mockup

| Tela do mockup | Rota no app | Status | Presentes/total |
|---|---|---|---|
| Home do membro | `/home` | Parcial | 17/34 |
| Minhas escalas | `/schedules` | Parcial (faltam filtros do mockup) | 7/28 |
| Convite de escala | — | **Ausente** (fundido no detalhe) | 0/30 |
| Detalhe da escala | `/schedule/[id]` | Funcional, parcial (renderiza observações, repertório com tons e equipe com status; faltam chegada/ensaio/culto/líder e "Abrir modo culto") | 9/30 |
| Música da escala | `/song/[id]` | Mínimo (título, artista, tom e 2 links; sem cifra, letra, notas, transposição, BPM, Spotify/YouTube) | 1/16 |
| Minhas contribuições | `/statement` | Parcial | 7/24 |
| Enviar comprovante | `/contribution` | Bom | 7/21 |
| Agenda | `/agenda` | Bom (sem filtros) | 12/30 |
| Conteúdo | — | **Ausente** | 0/31 |
| Leitura da palavra | — | **Ausente** | 0/19 |
| Escola Bíblica | — | **Ausente** (conceito inexistente no backend) | 0/31 |
| Detalhe da turma | — | **Ausente** | 0/27 |
| Perfil | `/profile` | Parcial | 15/28 |
| Notificações | `/notifications` | Casca (dados mock estáticos) | 25/30 |
| Detalhe da notificação | `/notification/[id]` | Funciona só para ids mock (`notif-*`) | — |
| Inscrição em turma | — | **Ausente** | 0/22 |
| Inscrição confirmada | — | **Ausente** | 0/15 |
| Minhas inscrições | — | **Ausente** | 0/25 |
| Editar dados pessoais | — | **Ausente** (existe "Solicitar alteração") | 0/24 |
| Preferências de notificações | — | **Ausente** | 0/25 |
| Minha família | — | **Ausente** | 0/20 |
| Solicitar vínculo familiar | — | **Ausente** | 0/20 |
| Privacidade | — | **Ausente** | 0/18 |
| Ajuda e suporte | — | **Ausente** | 0/19 |
| Diretório da igreja | — | **Ausente** | 0/22 |
| Perfil público do membro | — | **Ausente** | 0/14 |

### 3.3 Números finais de cobertura

- **Desktop:** das 23 telas, 8 têm rota equivalente (35 %), 15 não têm; cobertura textual média nas 8 mapeadas: **38 %** (variando de 30/79 em Criar escala a 60/85 na Agenda).
- **Mobile:** das 26 telas, 10 têm rota equivalente (38 %) e 16 não têm; cobertura textual nas 9 telas medidas: **100/241 = 41,5 %** (as duas telas de escala entram com as capturas por navegação real dentro do app, não por URL direta).
- **Conceitos do mockup que não existem em nenhuma camada (nem backend):** turma/matrícula/inscrição, repertório (Song/ScheduleItem sem view), equipes de louvor, conteúdo devocional (palavras), diretório, família/vínculo, privacidade, preferências de notificação, notificações reais, relatórios financeiros.

### 3.4 Aderência do design system (tokens)

O `theme.ts` foi derivado do mockup e está **alinhado**: das 15 cores declaradas em `doc.variables` do `.pen`, **14 existem em `mobile/src/theme.ts` com o hex idêntico** (comparação programática, ver `output/design-review/verificar-relatorio.py`).

| Mockup (token) | Hex | App (`theme.ts`) |
|---|---|---|
| `bg` | `#F6F7FB` | `canvas` |
| `surface` | `#FFFFFF` | `surface` / `surfaceTint` |
| `side` / `text` | `#101828` | `ink` |
| `muted` | `#667085` | `inkMuted` |
| `line` | `#E4E7EC` | `border` / `borderDivider` |
| `primary` | `#4F46E5` | `accent` |
| `primarySoft` | `#EEF2FF` | `surfaceSelected` |
| `green` | `#12B76A` | `success` |
| `greenSoft` | `#ECFDF3` | `badgeSuccessBg` |
| `amber` | `#F79009` | `warning` |
| `amberSoft` | `#FFFAEB` | `badgeWarningBg` |
| `red` | `#F04438` | `danger` |
| `redSoft` | `#FEF3F2` | `dangerBg` |
| `blueSoft` | `#EFF8FF` | **ausente** |
| `font` | `Inter` | **não aplicado** (a tipografia define tamanho/peso, sem `fontFamily`) |

O app acrescenta 9 tons que o mockup não declara (`#D0D5DD`, `#98A2B3`, `#344054`, `#067647`, `#B54708`, `#ABEFC6`, `#FEDF89`, `#FECDCA`, `#E0E7FF`) e mantém a escala de espaçamento de 4 pt (`4/8/12/16/20/28`) e raios (`12/16/999`) coerentes com os usados no mockup. **Conclusão: o gargalo não é a linguagem visual — é cobertura de telas e veracidade dos dados.**

---

## 4. O que está implementado e funciona (com prova de execução)

Fluxos exercitados ao vivo, com o resultado real da API:

| Fluxo | Rota | Resultado observado | Observação |
|---|---|---|---|
| Login por papel (membro/admin/tesouraria/líder) | `/` → `/home` | 200 + JWT, todos os 4 papéis | ok |
| Refresh automático de token em 401 | — | 1 refresh single-flight | ok (mas ver §5.7) |
| Extrato pessoal | `/statement` | `GET /me/statement/` 200, 13 lançamentos, totais e status | ok |
| Envio de contribuição **com comprovante** | `/contribution` | `POST /api/contributions/` **201**, redireciona para `/statement` | único fluxo que dá sensação de completude |
| Escala — ver detalhe, equipe e resposta | `/schedules` → `/schedule/[id]` | `GET /me/schedules/{id}/` 200 | ok |
| Escala — fluxo completo no mobile (390×844) | `/schedules` → `/schedule/1` | renderiza "Detalhe da Escala": observações, **REPERTORIO (4)** com tom, **EQUIPE ESCALADA (4)** com status por pessoa e o motivo da recusa com data | o único fluxo do mockup que já está praticamente completo |
| Música da escala (vindo do detalhe da escala) | `/song/[id]?scheduleId=` | 200, mostra título/tom/link de cifra | ok por navegação interna |
| Agenda pessoal — criar compromisso | `/agenda` | `POST /api/me/agenda/` **201** | cria, mas sem confirmação na tela |
| Solicitar alteração cadastral | `/profile` | `POST /api/me/member-requests/` **201** | aparece como "Última solicitação: Pendente" |
| Permissão de escrita respeitada no backend | `/schedule-create` como membro | `POST /api/schedules/` **403** | correto — mas invisível para o usuário (§5.1) |
| Contas sem vínculo de membro | `/profile` como tesouraria | `GET /me/member/` **403** com mensagem PT-BR clara | backend correto; front mostra banner cru |
| Backend — suíte de testes | `backend/` | `67 passed, 0 failed` | ok |

---

## 5. Defeitos confirmados (com reprodução)

### 🔴 Bloqueadores de demo/uso

**5.1 — `Alert.alert` é no-op no web: erro e sucesso invisíveis (14 chamadas em 8 telas).**
- Evidência: `mobile/node_modules/react-native-web/dist/exports/Alert/index.js` → `static alert() {}`. Chamadas em `LoginScreen.tsx:20`, `AgendaScreen.tsx:182,201`, `NewContributionScreen.tsx:115,138`, `ProfileScreen.tsx:163,170,173`, `ScheduleCreateScreen.tsx:30,44,47`, `ScheduleDetailScreen.tsx:56`, `SchedulesScreen.tsx:87`, `SongDetailScreen.tsx:38`.
- Reproduções (todas com `dialogs: []` na captura):
  - Membro em `/schedule-create` clica "Adicionar escala" → `POST /api/schedules/` **403**; a tela continua igual, sem mensagem (screenshot `output/design-review/flow-membro-create-escala.png`).
  - Admin em `/schedule-create` clica "Adicionar escala" → **201**, e **a URL permanece `/schedule-create`** com o formulário preenchido: o `router.replace("/agenda")` está no `onPress` do Alert (`ScheduleCreateScreen.tsx:44`), que nunca executa. Risco de duplicação por retry.
  - `/contribution` sem anexo → guarda "Comprovante obrigatório" (linha 115) não aparece: clique silencioso.
  - Login com senha errada → nada muda na tela (não há erro inline no `LoginScreen`).
- Impacto: no desktop, **nenhum** erro de validação, rede, 403 ou 500 chega ao usuário. No mobile nativo funciona — ou seja, o comportamento diverge entre plataformas.

**5.2 — Link direto de música renderiza a página de erro do Django dentro do app.**
- Reprodução: abrir `http://localhost:8081/song/1` (sem `?scheduleId`) → `GET /api/me/schedules/undefined/` **404** → o app exibe o **HTML de debug do Django** ("Page not found… No ScheduleAssignment matches the given query.") como conteúdo da tela (screenshot `output/design-review/shots/desktop-membro-song_1.png`, 109 KB de HTML).
- Causa: `SongDetailScreen.tsx:22` lê `scheduleId` dos params e não valida; `services/api.ts:118` devolve o corpo de erro text/html sem tratamento. Além de feio, **vaza stack trace/rotas internas** para o usuário.

**5.3 — Rotas inexistentes caem na tela padrão do Expo, em inglês.**
- Reprodução: `/membros`, `/bandas`, `/escola`, `/relatorios`, `/rota-inexistente` → "Unmatched Route / Sitemap" (≈90 bytes de texto; screenshots `shots/desktop-*-membros.png` etc.). Não existe `app/+not-found.tsx` em PT-BR.

### 🟠 Alto

**5.4 — Sidebar desktop: 16 itens em 8 grupos (+ `Configurações` sem rota), 5 destinos, 13 apontando para a tela errada.**
Mapa real extraído de `mobile/src/components/Screen.tsx:49-96` (tabela item a item, com status e decisão de MVP, em `docs/architecture/navegacao-mvp.md` §2):

| Item da sidebar | Rota real | Deveria ir para |
|---|---|---|
| Dashboard | `/home` | ok |
| Membros | `/profile` | lista de membros (inexistente) |
| Visitantes | `/profile` | visitantes (inexistente) |
| Visão geral / Contribuições / Relatórios (Financeiro) | `/home`, `/statement`, `/statement` | gestão financeira, relatórios (inexistentes) |
| Ministérios / Escalas | `/schedules` | escalas por ministério |
| Setlists / Repertório / Bandas (Louvor) | `/schedules` | repertório, bandas, setlists (inexistentes) |
| Escola Bíblica / Turmas (Ensino) | `/agenda` | EBD/turmas (inexistentes) |
| Agenda / Cultos | `/agenda` | detalhes do culto (inexistente) |
| Palavras | `/home` | palavras (inexistente) |
| **Configurações** | **nada** (não é Pressable) | configurações |

Além disso: `Buscar no Moriah` é um `View` decorativo (a home tem **0 inputs**, confirmado por `document.querySelectorAll('input').length`), o avatar da topbar mostra **"AM" fixo** para todos os papéis (a tesouraria e o líder aparecem como "AM"), e o badge do sino é **"3" fixo** enquanto a própria tela de notificações diz "Marcar todas como lidas (5)".

**5.5 — Dashboard desktop E home mobile com dados fictícios fixos.**
- Desktop: `mobile/src/screens/HomeScreen.tsx:48-53` define `248 / +8 este mês`, `R$ 12.450` (fallback quando não há contribuição), `6` cultos; `:71` gráfico com alturas `[52,78,64,92,70,86]`; `:92-100` listas de cultos/escalas fixas ("Celebração · Templo", "Ensino quarta · Projeção"); "Atividades recentes" idem. Verificado ao vivo: `/home` da tesouraria e do líder exibem exatamente esses números.
- Mobile: `HomeScreen.tsx:220-247` — fallback `R$ 450` / `12/09 • Dízimo • Confirmada`; bloco "Próximos" com `19h30 · Célula` e `09h · Escola Bíblica` fixos (a 3ª linha usa o compromisso real ou cai em `19h · Culto de celebração`); card "Continuar na Escola Bíblica" com `Fundamentos da Fé · 7 de 12 aulas` fixo; card "Última palavra" com `O Deus que vê / Pr. André` fixo. Verificado ao vivo (bloco "Próximos" exibe "Culto de celebração", evento que **não existe** no banco).
- Só são reais: "Escalas pendentes", a primeira linha de "Próximas escalas" (desktop), "Última contribuição" e "MINHA PRÓXIMA ESCALA" (quando há escala).
- **Bug adicional:** em `HomeScreen.tsx:247` o botão "Ler palavra" navega para `/statement` (extrato financeiro) — destino errado (verificado no código; não há tela de palavra).

**5.5b — A navegação inferior mobile diverge do mockup.**
Mockup: `Início · Agenda · Escalas · Conteúdo · Perfil`. App: `Início · Agenda · Escalas · Contribuições · Perfil` — sem a aba de Conteúdo, com a aba financeira no lugar.

**5.6 — Notificações são mock estático em memória.**
`mobile/src/notifications.ts` (73 linhas) define ids `notif-*`; não existe endpoint (`GET /api/notifications/` → 404). O sino não reflete nada, "Marcar todas como lidas" altera só estado local (some no reload) e `/notification/1` responde "Notificação não encontrada." (verificado).

**5.7 — Ruído no boot + dependência de dado de terceiros.**
Duas requisições **401** anônimas a `/api/me/` em toda carga (antes do token subir) e warning `"shadow*" style props are deprecated` (`Screen.tsx`). Também: nenhuma rota de API tem paginação/filtro (`DEFAULT_PAGINATION_CLASS` ausente e nenhuma view declara `filterset_fields`/`search_fields`), então `/me/statement/`, `/me/schedules/`, `/me/events/` crescem sem limite.

**5.8 — Tela de escalas não faz gestão.**
`/schedules` mostra "Gestão de escalas / + Criar escala" para tesouraria e líder (sem permissão) e a listagem usa `GET /me/schedules/` (escopo do próprio usuário) — um admin com escala publicada vê **"Nenhuma escala cadastrada"**. Não existe endpoint de listagem/gestão de escalas da igreja; `POST /api/schedules/` cria apenas evento + escala **sem formação/equipe** (o mockup pede ministério, funções, pessoas, conflitos e convites).

### 🟡 Médio / UX

**5.9 — Datas como texto ISO cru.** `ScheduleCreateScreen.tsx:59` (`2026-09-20T19:00:00-03:00`), `AgendaScreen.tsx:281-282`, `NewContributionScreen.tsx:171` (`AAAA-MM-DD`). Nenhum date/time picker; nenhum uso de picker nativo apesar de o Expo oferecer.

**5.10 — Contas sem vínculo de membro mostram dado errado.** Para tesouraria/líder: banner `Sem permissao` + mensagem crua do backend em `/profile` e `/statement`, e o nome do usuário é **derivado do e-mail** ("Teso", "Joao") — a tela exibe um nome que não é o do cadastro. Não existe fluxo de "vincular meu cadastro".

**5.11 — Estados contraditórios na agenda.** `/agenda` mostra ao mesmo tempo "Nao foi possivel carregar suas escalas agora." e "Nenhuma escala próxima." para contas sem vínculo.

**5.12 — Formulário de criação de escala sem guarda de papel.** Membro abre e preenche o formulário inteiro antes de descobrir (ou não descobrir, §5.1) que não tem permissão. Não há guarda de rota por papel no Expo Router.

**5.13 — Textos sem acento/typo.** "Enviar contribuicao", "Nenhuma alteracao", "Solicitacao enviada", "Nao foi possivel abrir este link", "Sem permissao", "Nenhuma escala próxima" vs. "não" — inconsistência dentro da mesma tela. Nas telas de escala vindas do seed: "OBSERVACOES", "REPERTORIO", "Musica", "Grande e o Senhor", "Chegar as 18h", "Traga seu proprio cabo" — os rótulos e os dados carregam a mesma falta de acentuação.

**5.14 — Detalhe da escala sem as informações do mockup.** Mockup pede chegada/ensaio/culto/líder/setlist/"Abrir modo culto"; o app mostra os campos que o backend devolve. Setlist, cifra com transposição (− Tom / + Tom), BPM e links Spotify/YouTube não existem na UI.

---

## 6. Lacunas funcionais (o que o mockup pede e o backend nem tem)

Da leitura de `backend/config/urls.py` + views (§`output/design-review/backend-inventario.md`):

**Existe no backend, sem UI (dinheiro fácil para a próxima sprint):**
- `POST /api/contributions/{id}/review/` → aprovar/rejeitar lançamento (tela **Gestão financeira** + **Detalhe de contribuição**, mockups #04 e #05). *Hoje só pelo Django Admin.*
- `POST /api/schedules/{id}/publish/` → publicar escala (#09/#19).
- `POST /api/schedules/{pk}/assignments/{pk}/substitute/` → pedir/substituir escalado (#08/#17).
- `POST /api/cell-meetings/` + `GET /api/leader/cell-members/` → célula (frequência, liderança) — nenhuma tela.
- `GET /api/me/events/` já alimenta a agenda, mas não há detalhe do culto (#11).

**Não existe em nenhuma camada:**
- Turma / matrícula / inscrição na EBD (#06, #07 desktop; #30, #31, #35–#37 mobile) — *"o conceito de inscrição em turma não foi implementado"*.
- Repertório/músicas/setlists (`Song`, `ScheduleItem`, `WorshipTeam` são só Admin), bandas/equipes, exportação Holyrics/ProPresenter.
- Conteúdo devocional ("Palavras"), diretório de membros, perfil público, família/vínculo familiar, privacidade, preferências de notificação, ajuda/suporte.
- Notificações reais (e-mail/push/lembrete de escala), relatórios financeiros agregados/exportação, cancelamento de escala, aplicação automática de requisição cadastral aprovada, logout/blacklist de token, troca/recuperação de senha.

---

## 7. Correções necessárias nas rotas

### 7.1 Árvore de rotas proposta (Expo Router)

Hoje: `index`, `home`, `profile`, `statement`, `contribution`, `agenda`, `schedules`, `schedule/[id]`, `schedule-create`, `song/[id]`, `notifications`, `notification/[id]`.

Proposta — cada item de sidebar/tab do mockup com rota própria, um arquivo por tela:

```
app/                          # autenticação
  index.tsx  (+ not-found.tsx em PT-BR)
  (tabs)/                     # mobile: Início, Agenda, Escalas, Conteúdo, Perfil
app/dashboard.tsx                                  # #01 Dashboard geral
app/financeiro/contribuicoes.tsx                    # #02 Minhas contribuições
app/financeiro/contribuicoes/nova.tsx               # #03 Registrar contribuição
app/financeiro/gestao.tsx                           # #04 Gestão financeira (tesouraria)
app/financeiro/contribuicoes/[id].tsx               # #05 Detalhe/aprovação
app/financeiro/relatorios.tsx                       # Financeiro > Relatórios
app/pessoas/membros.tsx  e  app/pessoas/membros/[id].tsx   # #12 Perfil do membro
app/pessoas/visitantes.tsx
app/ensino/index.tsx  e  app/ensino/turmas/[id].tsx        # #06, #07
app/ensino/turmas/[id]/inscricao.tsx  e  app/ensino/inscricoes.tsx   # #35–#37
app/escalas/index.tsx  app/escalas/nova.tsx  (+ publicar/substituir)
app/escalas/[id].tsx   app/escalas/[id]/convite.tsx       # #22, #23
app/cultos/index.tsx  app/cultos/[id].tsx                 # #10, #11
app/louvor/repertorio.tsx  app/louvor/bandas.tsx  app/louvor/bandas/[id].tsx   # #15, #16, #17
app/louvor/setlists/[id].tsx                              # #19, #14
app/musicas/[id].tsx                                      # #18/#24 (SPA + mobile)
app/palavras/index.tsx  app/palavras/[id].tsx             # #13/#28, #29
app/perfil/index.tsx  app/perfil/editar.tsx  app/perfil/familia.tsx  app/perfil/privacidade.tsx
app/perfil/notificacoes.tsx  app/perfil/notificacoes/[id].tsx  app/perfil/preferencias.tsx
app/perfil/ajuda.tsx  app/diretorio.tsx  app/diretorio/[id].tsx
app/leader/celula.tsx  app/leader/celulas/[id].tsx
```

### 7.2 Regras de rota a implementar

1. **Fonte única de verdade da sidebar** — hoje há dois arrays divergentes em `Screen.tsx` (`:49-96` desktop, `:98-104` mobile). Extrair um módulo novo `navigation.ts` com `{label, route, icon, capability}`, renderizar sidebar/tab a partir dele e **esconder (não só desabilitar)** itens sem capability — mata o "clique que não faz nada".
2. **Guarda de rota por papel** (ex.: `<RequireCapability can="management">` no `app/_layout.tsx`): `/escalas/nova`, `/financeiro/gestao`, `/ensino/*` de gestão não podem montar para membro. Hoje o formulário monta e o erro só aparece no 403.
3. Criar **`app/+not-found.tsx`** (novo) em PT-BR com caminho de volta — nenhuma URL deve cair em tela do Expo em inglês.
4. **`/musicas/[id]` exige contexto de escala** — se `scheduleId` faltar, redirecionar para `/escalas` (nunca chamar `/me/schedules/undefined/`) e tratar 404/erro do `api.ts` como dado, não como HTML.
5. **Busca global real** ou remoção do campo; `Configurações` precisa de rota (ou sai da sidebar).
6. **Prefixo de API versionado** (`/api/v1/`) e `+not-found` também para as rotas sem tela no mockup que hoje existem como casca (`bandas`, `escola`, `membros`, `relatorios`).

---

## 8. Correções necessárias nos processos

Prioridade **P0** (a demo quebra sem isso):

1. **Substituir `Alert.alert` por feedback in-app** nas 14 ocorrências: componente único (`Toast`/`InlineNotice`) com estado de erro/sucesso por tela. E, onde já existe feedback na tela (perfil, agenda, extrato), manter o dado atualizado — o problema não é só a mensagem invisível: também o **fluxo** (navegação pós-sucesso) está preso no callback do Alert.
2. **Navegação determinística pós-sucesso**: `router.replace("/agenda")` depois do `await api.post` (fora do Alert); bloquear reenvio (`submitting`) enquanto a navegação ocorre.
3. **Estados de erro de verdade**: banner com retry (já existe `ErrorNotice`) em *toda* tela que faz fetch, incluindo 403 "sem vínculo de membro", com ação "vincular meu cadastro".
4. **Guardas de escrita no front** espelhando as do backend (papel + vínculo de membro) — o usuário não deve preencher um formulário que vai dar 403.
5. **Remover dados fictícios do dashboard** ou marcá-los explicitamente como demonstração. Números reais exigem endpoints de contagem (`/api/overview/`) — sem isso, exibir zero/estado vazio é mais honesto que 248 membros inexistentes.

Prioridade **P1** (fechar os fluxos centrais do mockup com o que já existe no backend):

6. **Aprovar/rejeitar contribuição** (`/financeiro/gestao` + detalhe) usando `/api/contributions/{id}/review/` — a tela mais crítica do mockup para a tesouraria.
7. **Escala completa**: escolher ministério/função/pessoas na criação, ver conflitos, publicar (`/publish/`), convidar, responder (confirmar/recusar/indisponível) e **substituir** (`/substitute/`). Requer, no backend: `GET /api/schedules/` (gestão, escopo igreja) e CRUD de `ScheduleAssignment`.
8. **Notificações reais**: modelo + endpoint + marcar lidas persistente + sino com contagem real (hoje `3` fixo, dados mock).
9. **Datas com picker** (data/hora) em escala, agenda e contribuição — elimina o texto ISO e os erros de digitação.
10. **Paginação e filtros** nos endpoints de lista (`PAGE_SIZE`, `filterset_fields`, `search_fields`) — as telas com filtros do mockup (período/categoria/status, ministério, evento) precisam disso para existir de verdade.

Prioridade **P2** (produto que ainda não existe):
11. Escola Bíblica/turmas/inscrições (conceito novo — modelar antes de desenhar).
12. Repertório, bandas/equipes, setlist e modo culto (cifra, transposição, BPM, links).
13. Palavras/conteúdo, diretório, família/vínculo, privacidade, preferências, ajuda.
14. Relatórios financeiros/exportação, cancelamento de escala, blacklist de token, recuperação de senha, aplicação automática da requisição cadastral aprovada, auditoria completa (hoje cobre criação parcial).

**Divergência de marca a decidir**: o mockup usa "Igreja Nova Aliança / LumenChurch / Mariana Costa / R$ 450 etc."; o app e o seed usam "Igreja Moriah / Maria Silva". Os rótulos de tela (títulos, KPIs, textos de ajuda) precisam ser reescritos para os dados reais do Moriah antes de virar tela.

---

## 9. Sequência sugerida

| Sprint | Foco | Entrega |
|---|---|---|
| 1 | P0 (confiabilidade) | Toast/feedback, navegação pós-sucesso, `+not-found`, guardas de rota/papel, tratar 404 de `/musicas`, remover dados fictícios do dashboard |
| 2 | Rotas da sidebar | Árvore de rotas de §7.1 criada (mesmo que com estado vazio nas telas sem backend), sidebar como fonte única, busca/configurações resolvidos |
| 3 | Financeiro | Gestão financeira + detalhe/aprovação (endpoint já pronto), relatórios básicos |
| 4 | Escalas | Criação com formação/equipe, publicação, substituição, convite (backend: listagem + assignments) |
| 5 | Notificações + UX de datas | Modelo real de notificações, sino com contagem, pickers de data/hora, filtros+paginação |
| 6 | Domínios novos | EBD/turmas, repertório/bandas/setlist, palavras, perfil/família/diretório/privacidade |

---

## 10. Anexos — evidências geradas nesta análise

| Arquivo | Conteúdo |
|---|---|
| `output/design-review/mockup-inventario.md` | Inventário das 49 telas do mockup: mapa de navegação, estrutura de cada tela, textos literais, CTAs, notas de fidelidade |
| `output/design-review/mockup-tokens.md` | Design system do mockup: 16 tokens, cores, tipografia, raios, espaçamentos |
| `output/design-review/backend-inventario.md` | 24 operações em 19 caminhos, permissões por papel, 9 processos de negócio (BP-1..BP-9), lacunas, riscos, 67 testes |
| `output/design-review/qa-sweep.json` | Varredura de rotas × papéis × viewports com textos renderizados, erros de console e HTTP |
| `output/design-review/qa-flows2.json` | Fluxos de escrita com payload/status de cada requisição e diálogos capturados |
| `output/design-review/qa-mobile-flow.json` | Fluxo mobile completo do membro (home → escalas → detalhe → música) com o texto renderizado em cada passo |
| `output/design-review/shots/*.png` (60+) | Capturas por rota e papel (desktop e mobile) |
| `output/design-review/flow/*.png` e `flow-*.png` | Evidências dos fluxos: contribuição sem/com arquivo, criação de escala (membro e admin), compromisso, solicitação cadastral, popover do sino, música, notificação |
| `tmp/qa-walkthrough.mjs`, `tmp/qa-flows2.mjs`, `tmp/qa-diag-post.mjs`, `tmp/qa-diag2.mjs` | Scripts de QA executáveis (Playwright + Chromium sobre o Expo Web) |
| `tmp/qa-mobile-flow.mjs` | Navegação real no viewport mobile (390×844) com captura por passo |

Comandos para reproduzir:

```bash
# app web
cd mobile && npx expo start --web            # http://localhost:8081
# QA de rotas
PW_ENTRY=<playwright/index.mjs> PW_CHROME=<chromium/chrome.exe> node tmp/qa-walkthrough.mjs
# QA de fluxos
PW_ENTRY=<playwright/index.mjs> PW_CHROME=<chromium/chrome.exe> node tmp/qa-flows2.mjs
# backend
docker exec moriah_app-backend-1 python manage.py test  # ou: cd backend && python -m pytest -q
```
