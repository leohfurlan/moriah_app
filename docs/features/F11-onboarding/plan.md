# F11 — Plano de implementação proposto

Revisão 1, 09/10/2026; **plano proposto, produto aprovado**. [PRD v1.2](../../../PRD_Moriah_App_v1.md),
[spec](spec.md), [contrato v1](contract.md).

## Dependências e sequência

F01/F02 fornecem identidade e vínculo; F03/F05/F06 fornecem configurações;
F07/F08 recebem as jornadas. Não há dependência de F10 nem do roadmap F09 completo.
Os provedores atuais existem, mas precisam dos ajustes explicitados na spec.
Não confundir existência de modelo com editor ou contrato completo pronto.

1. **Revisar contrato com D01/D02 aprovadas.** Grade semanal própria e perfil
   obrigatório antes das demais telas. Verificar permissões reais de Admin/editores; confirmar
   que Event.active significa publicação nesta entrega. Atualizar artefatos de
   forma coordenada. Checkpoint: nenhum resultado obrigatório indefinido.
2. **Entregar acolhida e perfil pessoal completos.** Estado no servidor,
   nascimento/relacionamento, retomada entre dispositivos, conclusão e guardas
   conforme D02, inclusive admin sem Member e WhatsApp já vinculado. Migrações
   aditivas e rascunho com dados existentes. Demonstrar API + tela + validações.
3. **Integrar conferência cadastral e próximos passos.** Ajustar abertura de
   vínculo para visitante, idempotência e revisão concorrente; preservar
   dependências do perfil visitante e solicitações de alteração. Exibir destinos
   por relação, horários e estados vazios. Checkpoint: aprovação humana real em
   base isolada, sem apropriação de cadastro alheio.
4. **Entregar checklist compartilhado e card.** Seis itens, confirmações com
   autoria, predicados atuais, card individual dispensável a 100%, reaparecimento
   após regressão, acesso permanente nas configurações. Sem exigir todas as
   configurações antes de operar painel. Demonstrar duas contas administrativas
   e igreja de controle negativo.
5. **Aceite integrado e preparação operacional.** Rodar gates da spec,
   PostgreSQL para concorrência, desktop/celular com transporte WhatsApp fictício
   local. Ensaiar migração/rollback em base descartável. Produzir relatório de
   evidências e pendências. Commit, publicação e deploy dependem de autorização.

## Definition of done

- R01–R12 e E01–E14 cobertos por resultados observáveis.
- Contrato fechado, schema compatível, login legado e revisão humana preservados.
- Testes existentes e novos gates acordados executados, com saída e ambiente
  registrados; testes simulados não substituem integração com banco real.
- Jornada desktop/mobile validada, sem loops, atalhos sem permissão ou perda de rascunho.
- Migração ensaiada sem produção; nenhum dado pessoal em fixtures ou relatórios.

Especificação, implementação e integração têm estados separados. A divisão foi
aprovada e a implementação autorizada e concluída localmente. Evidências no
[relatório](../../relatorio-implementacao-onboarding-2026-10-09.md).
Sem publicação externa, commit, push ou deploy.
