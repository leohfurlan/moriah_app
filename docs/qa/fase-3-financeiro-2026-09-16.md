# Fase 3 — Gestão financeira

Implementação e validação em 16/09/2026 na branch `codex/fase-3-gestao-financeira`.
As alterações locais da Fase 4 foram preservadas e não fazem parte deste escopo.

## Entrega

- Lista por igreja, filtros por status e período, detalhe e abertura de comprovantes.
- Revisão acessível pelo menu desktop, aba mobile e ação na Home de gestão,
  inclusive para tesouraria sem cadastro de membro.
- Aprovação/rejeição restrita a tesouraria/admin e capacidade correspondente na UI.
- Transições `pending`/`needs_review` para `approved`/`rejected` sob transação e lock.
- Lock limitado à contribuição, compatível com o JOIN opcional no PostgreSQL.
- Motivo obrigatório somente para nova rejeição; repetição da decisão retorna 200
  sem regravar responsável, data, motivo ou auditoria; decisão oposta retorna 409.
- Nota do membro preservada; histórico e responsável disponíveis após reload.
- Lista atualizada após decisão; respostas atrasadas ignoradas; bloqueio de ações
  durante envio; estados de carregamento, erro, retry e lista vazia.
- Schema financeiro com histórico estruturado, filtros e payload de revisão.

## Evidência executada

- Conteúdo isolado preparado para commit (sem Fase 4): 95 testes passaram, SQLite.
- A suíte na árvore local com Fase 4 também passou: 110 testes.
- Financeiro PostgreSQL 16: 29 testes passaram em banco de testes separado.
- Mobile: `npm run typecheck` passou.
- Django: `check` passou e `makemigrations --check --dry-run` não apontou mudanças.
- QA web com viewport mobile: 14 PASS, 0 FAIL, sem exceções JavaScript.
  Evidência regenerável: `docs/qa/evidencias/fase3-2026-09-16T142519`.

O QA de UI utiliza respostas simuladas (incluindo erro 500 e resposta atrasada).
As transições, idempotência, isolamento por igreja e auditoria com JWT foram
exercitados separadamente pela suíte real em PostgreSQL. Não houve validação em
aparelho Android/iOS nem deploy.

A geração do schema ainda registra avisos de accounts e erro de introspecção
em `ScheduleAssignmentDeleteView`, da alteração local de escalas. O financeiro
não emitiu avisos de tipos de histórico/responsável. O schema global deve ser
validado novamente ao concluir a Fase 4.

A entrega da Fase 3 foi separada das alterações locais da Fase 4 antes da publicação.
As validações de backend/PostgreSQL e TypeScript foram repetidas no conteúdo
exato preparado para commit, com os mesmos resultados financeiros.
