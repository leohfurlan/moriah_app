# Fase 1 — Confiabilidade P0 (verificação)

- Data: 16/09/2026
- Plano: `docs/plano-mvp-moriah-execucao-2026-09-16.md` §6.1–6.6
- Verificador: `node tools/qa/run.mjs fase1` (ver `tools/qa/README.md`)
- Evidência: `docs/qa/evidencias/fase1-2026-09-16T123250/` (`resultados.json`, `resumo.md`, `shots/*.png`)
- Resultado: **18 checks, 18 PASS, 0 FAIL**
- Observação: esta evidência foi gerada antes das correções desta revisão; os checks devem ser reexecutados antes do commit.

| # | Critério do plano | O que o check provoca | Resultado |
|---|---|---|---|
| 1 | Login inválido mostra erro | senha errada na tela de login | PASS — "Acesso negado" visível, `role=alert` presente, 0 dialogs nativos |
| 2 | Membro não cria escala e entende o bloqueio | conta de membro abre `/schedule-create` na mão | PASS — toast "Acesso restrito / Sua conta não tem permissão para criar escalas." e volta para `/schedules`; 0 POST de escala |
| 3 | Gestão cria escala com confirmação e vai para a agenda | conta de gestão preenche e envia o formulário | PASS — toast "Escala criada / O evento foi adicionado à agenda da igreja." e `router.replace('/agenda')` |
| 4 | Clique repetido não duplica | 3 cliques no mesmo tick | PASS — exatamente 1 `POST /api/schedules/` |
| 5 | Contribuição sem comprovante é barrada com aviso | envio sem anexo | PASS — aviso "Comprovante obrigatório" na tela; 0 POST |
| 6 | Erro de API nunca mostra HTML do Django | `GET /api/me/statement/` forçado a 500 com HTML do Django | PASS — 500 chegou, HTML não apareceu, mensagem amigável no lugar |
| 7 | Rota inexistente abre 404 em português | `/rota-que-nao-existe-qa` | PASS — página PT-BR do app; nada do "Unmatched Route" do expo-router |
| 8 | Música sem contexto não chama API com `undefined` | `/song/1` sem `scheduleId` | PASS — 0 requisições com `undefined`, tela orienta a abrir a escala |
| 9 | Nenhum KPI/listas inventadas no painel | `/home` da conta de membro (desktop) | PASS — "Membros ativos/248", "87% confirmado", "7 de 12 aulas", "Continuar na Escola Bíblica", "Adicionar membro/Criar culto/Criar turma" ausentes; painéis reais presentes |

## O que mudou

### 6.1 Erros de API legíveis (sem vazamento técnico)

- `mobile/src/services/api.ts`: payload de erro passa por `payloadDeErro(...)` —
  corpo `text/html` (erro do Django/proxy) é descartado com aviso no console
  antes de chegar à UI; resposta 2xx que não é JSON vira erro tratado em vez de
  estourar `Unexpected token '<'` na tela.
- `mobile/src/services/errors.ts`: mapa único por status com textos PT-BR
  (400/422, 401, 403, 404, 409, 5xx), `NetworkError` ("Sem conexão") e
  `SessionExpiredError` ("Sessão expirada").

### 6.2 Feedback visível em vez de `Alert`

`Alert.alert` é no-op no react-native-web, então nenhum aviso aparecia no
desktop — e a navegação dentro do `onPress` do Alert nunca rodava.

- Novo `mobile/src/components/Feedback.tsx`:
  - `InlineNotice` — erro/validação preso ao ponto da ação;
  - `mostrarToast` + `ToastHost` — conclusão de ação, com estado no **módulo**
    (não em `useState` do provider): o aviso disparado junto com
    `router.replace(...)` sobrevive à remontagem da árvore. Sem isso, o toast
    morria na navegação e a pessoa era jogada na tela seguinte sem explicação
    (defeito encontrado e corrigido durante esta verificação — ver
    `tools/qa/scripts/diagnostico-toast.mjs`).
- `Alert.alert` removido das 8 telas que o usavam (`LoginScreen`,
  `AgendaScreen`, `NewContributionScreen`, `ScheduleCreateScreen`,
  `ScheduleDetailScreen`, `SchedulesScreen`, `ProfileScreen`,
  `SongDetailScreen`); risco de duplo envio coberto por trava de reentrância
  (`submittingRef`/`submitting`, `actingId`).

### 6.3 Escrita acidental e duplicidade

- `ScheduleCreateScreen`: `submittingRef` + `submitting` bloqueiam o segundo
  clique no mesmo tick; sucesso publica toast e navega para `/agenda`.
- `NewContributionScreen`: não envia sem comprovante (aviso inline) e tem trava
  de reentrância.

### 6.4 Capacidade, não "tente e falhe"

- `mobile/src/navigation.ts` — `CAPACIDADES_DE_ESCALA` e
  `podeGerenciarEscalas()`: fonte única no cliente.
- `mobile/app/_layout.tsx` — `ROTAS_DE_GESTAO` exige capacidade; sem ela o item
  não aparece no menu e a URL digitada à mão avisa e redireciona.
- Backend: `IsScheduleCoordinatorOrAdmin` ganhou `message` em PT-BR
  (`apps/accounts/permissions.py`) e `user_capabilities()` passou a publicar
  `manage_schedules` para ADMIN, PASTOR e COORDINATOR — a mesma regra que a
  permissão aplica, para o cliente não adivinhar quem pode operar escalas.
- Testes novos: `apps/schedules/tests/test_schedule_create.py`
  (membro → 403 com mensagem; admin/pastor/coordinator criam e têm a
  capacidade) e `apps/accounts/tests/test_account_capabilities.py`
  (capacidade por papel; membro comum sem capacidade).

### 6.5 Rotas e estados vazios

- `mobile/app/+not-found.tsx`: 404 em português com caminhos de volta.
- `mobile/src/screens/SongDetailScreen.tsx`: sem `id`/`scheduleId` na URL não há
  chamada de API — a tela explica que a música pertence a uma escala e leva para
  `/schedules` (antes montava `/me/schedules/undefined/`).

### 6.6 Painel sem dado inventado

`mobile/src/screens/HomeScreen.tsx` agora deriva tudo de `/me/schedules/`,
`/me/statement/`, `/me/agenda/` e `/me/events/`:

- métricas: contribuições do mês (soma real), próximos eventos (contagem real),
  escalas pendentes e confirmadas;
- gráfico de 6 meses calculado do extrato; sem dado mostra "Sem dados
  disponíveis" (o mínimo visual de 6 px não finge valor);
- listas "Próximos cultos e eventos", "Minhas próximas escalas" e "Últimas
  contribuições" com dados reais e vazio explícito;
- ações rápidas só com destinos reais (`Registrar contribuição`, `Criar escala`
  quando há capacidade, `Minha agenda`, `Meu extrato`, `Ver escalas`);
- cards sem lastro no produto removidos (Escola Bíblica "7 de 12 aulas",
  "Última palavra"); indicadores da igreja inteira ficam no painel de gestão;
- badge do sino removido conforme a decisão D7; a lista de notificações continua
  local e rotulada como demonstração no popover.

## Reprodução

```bash
# backend + Expo web no ar
node tools/qa/run.mjs fase1
cd backend && python -m pytest -q      # 75 testes (inclui os 4 novos)
```

## Lacunas conhecidas (não bloqueiam a fase)

- O toast não é anunciado como `role="status"` (usa `role="alert"`); leitura de
  tela repete a mensagem a cada mudança de tom.
- `manage_schedules` é publicado para quem o backend já autorizava; contas com
  papel de coordenação antigo sem esse papel continuam sem o item de menu (o
  backend segue sendo a autoridade final).
