# Verificador QA (Playwright)

Verificador de aceite do MVP. Cada fase do plano de execução
(`docs/plano-mvp-moriah-execucao-2026-09-16.md`) tem um arquivo de checks, e
cada check corresponde a um critério de aceite escrito no plano — nada de
"conferi no olho".

```
tools/qa/
  run.mjs                 runner: sobe o navegador, roda a fase, grava evidência
  lib/pw.mjs              resolve o Playwright/Chromium disponíveis na máquina
  lib/harness.mjs         sessão instrumentada (console, pageerror, HTTP >= 400, dialogs, escritas)
  lib/accounts.mjs        contas demo lidas do seed do backend
  lib/report.mjs          acumulador PASS/FAIL + resultados.json + resumo.md
  checks/fase1.mjs        confiabilidade P0 (seção 6.1–6.6 do plano)
  checks/fase2.mjs        navegação (menu lateral, abas, avatar, busca, capacidades)
  checks/fase4.mjs        gestão de escalas (seção 9.1–9.3 do plano)
  checks/fase5.mjs        estabilização de notificações/extrato/conflito com API simulada
  tests/mobile-regressions.cjs  regressões dos módulos reais, sem React Native/banco
  scripts/               diagnósticos pontuais (ex.: por que o toast não aparece)
```

## Como rodar

Pré-requisitos: Expo web servindo o app; fases 1/2/4 também exigem backend.
Fases 3/5 usam API simulada. A fase 5 intercepta os prefixos `/api`, `/backend`
e `/local-api`; nenhum endpoint interceptado é repassado a um backend real.

```bash
# app (mobile/) em http://localhost:8081 e API respondendo
node tools/qa/run.mjs fase1      # só a fase 1
node tools/qa/run.mjs fase2      # só a fase 2
node tools/qa/run.mjs fase4      # só a fase 4 (gestão de escalas)
node tools/qa/run.mjs fase5      # regressões focadas, API simulada, desktop/mobile web
node tools/qa/run.mjs todas      # todas
```

Saída: uma linha `PASS`/`FAIL`/`AVISO` por check e o código de saída
(`0` = tudo passou, `1` = houve falha, `2` fase inválida, `3` app fora do ar).

Evidência por execução, em `docs/qa/evidencias/<fase>-<carimbo>/`:

A fase 5 usa `output/playwright/fase5-<carimbo>/`. Ambos são ignorados pelo Git.

- `resultados.json` — itens, duração, base URL, metadados do comando;
- `resumo.md` — a mesma tabela, legível;
- `shots/*.png` — screenshot do momento de cada check.

O diretório de evidências é regenerável e está no `.gitignore`; o que entra no
repositório são os relatórios `docs/qa/fase-*.md`.

Variáveis úteis: `QA_BASE` (default `http://localhost:8081`), `QA_SEED`
(caminho do seed, default `backend/apps/accounts/management/commands/seed_mvp.py`),
`PW_ENTRY` (entrada do Playwright).

## Armadilhas que o harness já resolve

- **`Alert.alert` é no-op no react-native-web.** Todo check de feedback verifica
  o texto na tela (ou o toast), e os checks 1b/2 falham se um dialog nativo for
  disparado em vez disso.
- **`fill()` não atualiza o estado do React no RN Web.** Use `digitar()` do
  harness (clique + `pressSequentially`), senão o formulário envia valores
  antigos e o check passa/falha por motivo errado.
- **O toast some em 6 s.** Leia o texto por `[data-testid="toast"]` logo após a
  ação, não depois de esperas longas.
- **Nunca copie e-mail/senha do output de ferramenta para o código**: no
  Windows as sequências de dígitos saem mascaradas no print. `lib/accounts.mjs`
  extrai as credenciais do próprio seed em tempo de execução.
- **Playwright pode existir só no cache do npx** (sem `node_modules` local);
  `lib/pw.mjs` resolve o pacote por caminho absoluto e impõe o Chromium
  instalado em `%LOCALAPPDATA%/ms-playwright`.

## Diagnósticos

```bash
node tools/qa/scripts/diagnostico-toast.mjs   # linha do tempo: o toast apareceu? por quanto tempo?
```

## Estado atual

- `fase1`: 18 checks (18 PASS) — evidência `docs/qa/evidencias/fase1-2026-09-16T123250`.
- `fase2`: 13 checks (13 PASS) — evidência `docs/qa/evidencias/fase2-2026-09-16T123353`.
- Relatórios: `docs/qa/fase-1-confiabilidade-2026-09-16.md`,
  `docs/qa/fase-2-navegacao-2026-09-16.md`.


## Fase 3 — revisão financeira

`node tools/qa/run.mjs fase3` executa 14 verificações da UI com API simulada,
sem gravar decisões no banco da aplicação. Cobre acesso mobile de tesouraria sem
membro, guarda de capacidades, comprovantes, motivo obrigatório, atualização
após decisão, histórico, filtros, respostas atrasadas e recuperação de erro.

As regras reais e a auditoria com JWT são verificadas por:

```powershell
cd backend
python -m pytest apps/finance/tests -q
$env:POSTGRES_HOST = '127.0.0.1'
python -m pytest apps/finance/tests -q --ds=config.settings_test_postgres
```

A configuração PostgreSQL mantém os demais isolamentos dos testes e o Django
cria/remove `test_<POSTGRES_DB>`. O job `finance-postgres` agora cobre também
escalas e notificações. A alteração do CI não significa que ele foi executado.

## Regressões da estabilização da fase 5

```powershell
# Na raiz, com Expo local na porta escolhida; dispensa backend e seed
$env:QA_BASE = 'http://127.0.0.1:8085'
node tools/qa/run.mjs fase5

# Módulos reais de notificações, erros, datas e gráfico, sem navegador
cd mobile
$env:TZ = 'America/Sao_Paulo'
npm test
npm run typecheck
```

O teste de navegador é focado e simulado: não atesta PostgreSQL, integração
end-to-end com JWT, deploy ou comportamento em dispositivos Android/iOS nativos.
O QA da fase 2 deixou de exigir Conteúdo e de contar dados de `MVP_NOTIFICATIONS`;
usa o badge específico e o contador devolvido pela API. Seu resultado de 16/09
continua sendo histórico, não uma reexecução com este working tree.
