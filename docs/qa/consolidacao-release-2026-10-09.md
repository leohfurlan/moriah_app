# Consolidação para publicação — 09/10/2026

O branch reúne financeiro, Conteúdo/eventos, WhatsApp, infraestrutura KingHost,
menu da conta, solicitações de vínculo para administradores e restauração da aba
Conteúdo mobile com botão central de contribuição. Os diagnósticos locais sem
credenciais foram incluídos conforme pedido de versionar todas as alterações.

## Resolução dos conflitos com master

- Mantidos o editor Markdown, edição/exclusão de publicações e menu já implantados.
- Mantida a migration inicial e o modelo de Conteúdo efetivamente implantados,
  evitando reescrever o esquema de uma migration já aplicada.
- Incorporadas as verificações de igreja, limite de corpo de 50.000 caracteres,
  paginação opcional, auditoria transacional, bloqueio de linhas e idempotência
  de publicação de master. Mantidos os testes dos dois lados.
- O teste de ciclo editorial de master foi atualizado para o contrato implantado:
  liderança pode editar publicação, com auditoria. O teste independente desse
  contrato permanece em `test_content_api.py`.
- CI preserva guardas e build do piloto e inclui Conteúdo/membros no PostgreSQL.
- Removido registro duplicado de `apps.content` produzido pelo merge automático.

## Evidência local após consolidação

- PostgreSQL isolado: 277 testes aprovados.
- `makemigrations --check --dry-run`: nenhuma mudança detectada.
- TypeScript e 13 regressões mobile aprovados.
- QA fase 5: 13 verificações aprovadas; fase 6: 20 verificações aprovadas.
- Layout: membro/admin/tesouraria em 360, 390 e 430 px e desktop aprovados,
  incluindo abertura de Conteúdo e centralização da contribuição.

As verificações locais usam bancos de teste ou API simulada, sem aprovar pedidos
reais. A publicação aplica o runbook KingHost e exige backup verificado,
labels de revisão e readiness. O PR permanece aberto para merge em master.
