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
  scripts/               diagnósticos pontuais (ex.: por que o toast não aparece)
```

## Como rodar

Pré-requisitos: backend no ar e Expo web servindo o app.

```bash
# app (mobile/) em http://localhost:8081 e API respondendo
node tools/qa/run.mjs fase1      # só a fase 1
node tools/qa/run.mjs fase2      # só a fase 2
node tools/qa/run.mjs fase3      # revisao financeira
node tools/qa/run.mjs todas      # todas
```

Saída: uma linha `PASS`/`FAIL`/`AVISO` por check e o código de saída
(`0` = tudo passou, `1` = houve falha, `2` fase inválida, `3` app fora do ar).

Evidência por execução, em `docs/qa/evidencias/<fase>-<carimbo>/`:

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
cria/remove `test_<POSTGRES_DB>`. O CI inclui o job `finance-postgres`.
