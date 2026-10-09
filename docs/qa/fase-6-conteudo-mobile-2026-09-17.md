# Fase 6 — Conteúdo: primeira fatia vertical

**Data:** 17/09/2026. **Base:** working tree sobre `0564ca5`.
**Escopo:** domínio Conteúdo em texto simples; os outros domínios da Fase 6 permanecem futuros.

## Implementado

- Modelo `Content` por igreja, autor, título, resumo, corpo, rascunho/publicado e datas.
- Migration `content/0001_initial.py`, criada sem migrar o banco da aplicação.
- Capacidades `read_content` e `manage_content` em `/api/me/`.
- Membros vinculados leem publicações da própria igreja. Admin/superuser/pastor
  podem operar conteúdo sem vínculo de membro, sempre com igreja associada.
- API de lista paginada, detalhe, criação, edição de rascunho, publicação e retirada.
- Auditoria transacional e locks de linha nas mutações; publicação/retirada idempotentes.
- Interface desktop/mobile com lista, detalhe, formulário, publicação e retirada do ar.
- Guard em lista e deep links, estados loading/vazio/erro, retry e preservação dos campos.
- Navegação com Conteúdo e ação central de contribuição preservada.
- Teste do destaque verifica unicidade e mudança ao sair da rota, evitando fundo fixo como falso positivo.

Contrato e critérios: [conteudo-api.md](../architecture/conteudo-api.md).

## Validação executada

| Check | Resultado |
|---|---|
| Backend completo, SQLite isolado | 153 PASS, 1 SKIP (concorrência exclusiva de PostgreSQL) |
| Conteúdo, PostgreSQL isolado | 19 PASS, incluindo concorrência e JWT real |
| QA Conteúdo com API simulada, 390×844 e 1440×1024 | 20 PASS / 0 FAIL |
| QA regressão Fase 5 com API simulada | 12 PASS / 0 FAIL |
| Regressões mobile sem navegador | 11 PASS |
| TypeScript | PASS |
| Migration drift e `git diff --check` | PASS |

QA: Expo iniciado a partir deste checkout em `http://127.0.0.1:8086`.
Evidências: `docs/qa/evidencias/fase6-2026-09-17T205422` e
`output/playwright/fase5-2026-09-17T205256` (diretórios ignorados pelo Git).
Screenshots de detalhe revisados no desktop e mobile.

```powershell
$env:QA_BASE = 'http://127.0.0.1:8086'
node tools/qa/run.mjs fase6
node tools/qa/run.mjs fase5
npm --prefix mobile run typecheck
npm --prefix mobile test
Set-Location backend
python -m pytest -q -p no:cacheprovider
$env:POSTGRES_HOST = '127.0.0.1'
python -m pytest apps/content/tests -q -p no:cacheprovider --ds=config.settings_test_postgres
python manage.py makemigrations --check --dry-run --settings=config.settings_test
```

Testes de API confirmam: payload não escolhe igreja/autor/publicação; membro não escreve;
rascunho/objeto de outra igreja retorna 404; aliases preservam autorização; falta de vínculo
ou igreja retorna 403; validação vazia/limites não persiste; edição publicada retorna 409;
auditoria falha reverte publicação; duas publicações concorrentes via JWT geram uma auditoria.

QA web confirma: loading, vazio, falha de lista/retry, paginação, detalhe/reload,
403/404, validação 422 simulada preservando formulário, publicação com falha/retry,
retirada persistente, rascunho invisível ao leitor, deep link sem capacidade bloqueado,
401 com refresh recusado encerra sessão, sem exceções JS ou endpoints inesperados.

## Limites

API e UI foram verificadas separadamente; não houve um fluxo de navegador completo contra
o backend real. PostgreSQL usa banco `test_<POSTGRES_DB>`, não o banco da aplicação.
Não foram validados Android/iOS nativos, anexos/mídia, deploy ou publicação de dados reais.
Migration da aplicação, commit, push e deploy não foram executados.

## Redeploy local autorizado — 17/09/2026, 21:13

Após a validação acima, o usuário autorizou o redeploy e acesso pelo ngrok.
Backend reconstruído, build Expo web exportado, containers db/backend/mobile/proxy
recriados com volumes preservados e `content/0001_initial` aplicada ao banco local.
Backup `tmp/moriah-before-phase6.dump` gerado e validado antes da troca.
Seed não reexecutado. Override operacional: `tmp/redeploy-phase6.override.yml`.

Login JWT real local via proxy confirmado para membro/admin, capacidades corretas
e GET de lista real retornando 200. Página pública e bundle retornam 200;
SHA-256 do bundle público coincide com o arquivo exportado; API anônima retorna 401.
QA do build estático: 20 PASS / 0 FAIL em desktop/mobile, com API simulada;
evidência `docs/qa/evidencias/fase6-2026-09-17T211247`.
URL confirmada: https://saprogenic-saul-heavies.ngrok-free.dev.
Sem commit/push ou deploy em servidor externo. Preview depende deste computador e do ngrok ativos.
