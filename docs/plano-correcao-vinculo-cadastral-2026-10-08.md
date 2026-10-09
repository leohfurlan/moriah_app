# Plano de correção — solicitações de vínculo cadastral

## Problema confirmado

Em produção, a solicitação #1 de admin.moriah foi criada em 08/10/2026 às
14:04:46 (São Paulo), com resposta HTTP 201. Está pendente, sem candidato e
sem revisor. Não existem notificações. A API atual grava o pedido e o painel
Django permite revisá-lo, mas o app não possui encaminhamento nem fila de revisão.

## Resultado esperado

Solicitar no Perfil → receber confirmação e status → responsáveis recebem
notificação no app → abrir fila → selecionar cadastro existente da mesma igreja
→ aprovar ou rejeitar → solicitante recebe resultado e Perfil reflete o vínculo.

Responsáveis são usuários ativos da mesma igreja com capacidade manage_members ou manage_all.
O solicitante também recebe o aviso de revisão quando possui essa capacidade:
o administrador poderá revisar sua própria solicitação, mediante confirmação
explícita. A solicitação, isoladamente, nunca atribui cargo ou permissão.

## Etapas de implementação

1. **Centralizar o fluxo no backend.** Serviço único para abertura, aprovação e
   rejeição, usado pela API e pelo Django admin. Autorização por manage_members ou manage_all,
   escopo obrigatório da igreja, auditoria de autor/data/decisão e transações
   com bloqueio dos registros envolvidos. Impedir duas solicitações pendentes
   da mesma conta e a associação concorrente de um membro a duas contas.
2. **Criar API de revisão.** Listar e detalhar pedidos com filtro de status;
   pesquisar candidatos da mesma igreja; aprovar com candidato obrigatório;
   rejeitar com motivo. Recusar candidato de outra igreja, já vinculado ou
   revisão conflitante. Repetir a mesma decisão não duplica vínculo nem avisos;
   decisões incompatíveis retornam conflito. Não alterar dados cadastrais ou
   papéis da conta ao associar o membro.
3. **Encaminhar e notificar.** Reutilizar Notification, com chave de deduplicação
   por pedido, evento e destinatário. A abertura cria aviso aos responsáveis
   com link direto para a revisão; a decisão avisa o solicitante, com link ao
   Perfil e motivo quando rejeitada. Pedido e notificações são persistidos
   atomicamente. Nesta entrega, avisos ficam no app; WhatsApp de autenticação
   permanece independente. Se não houver responsável ativo, manter o pedido
   visível na fila e registrar a ausência para diagnóstico.
4. **Disponibilizar a fila no app.** Entrada “Solicitações de vínculo” na gestão,
   visível com manage_members ou manage_all, incluindo administradores sem cadastro
   de membro. Lista de pendentes, aprovadas e rejeitadas; detalhe do solicitante,
   candidato sugerido quando houver, busca de membro, confirmação de aprovação
   e rejeição com motivo. Tratar loading, vazio, erro/retry e conflito sem falso
   sucesso. O sino e a lista de notificações abrem esse detalhe.
5. **Melhorar o Perfil.** Mostrar data e situação do pedido, mensagem clara de
   espera, motivo da rejeição e possibilidade de nova solicitação após rejeição.
   Atualizar Perfil/capacidades após aprovação, sem exigir novo login. Atualizar
   notificações ao retornar ao app e após ações; não depender de recarregar a
   página inteira para revelar avisos.
6. **Recuperar os pedidos existentes.** Comando idempotente, com dry-run, para
   criar as notificações ausentes dos pedidos pendentes. Executá-lo após o
   deploy para incluir a solicitação #1. Não aprovar automaticamente nem criar
   um membro fictício. Se não existir cadastro correspondente, cadastrar a
   pessoa pelo fluxo autorizado de membros antes da aprovação.

## Critérios de aceite e testes

- Administrador solicitando seu próprio vínculo recebe aviso e vê seu pedido
  na fila, mesmo sem member_profile.
- Secretaria/admin da mesma igreja podem revisar; conta comum e responsável
  de outra igreja não podem listar, consultar ou decidir os pedidos.
- Abrir novamente o pedido pendente não gera duplicata, inclusive sob concorrência.
- Aprovação associa exatamente o membro escolhido à conta, grava revisor/data
  e auditoria, e notifica o solicitante. Rejeição exige motivo e não cria vínculo.
- Revisões simultâneas e tentativas de tomar cadastro já vinculado falham com
  resposta clara, sem alteração parcial.
- API e Django admin aplicam as mesmas regras; um caminho não contorna o outro.
- Recuperação de pendentes pode ser repetida sem duplicar notificações.
- Testes backend em PostgreSQL isolado, TypeScript, testes mobile e QA de ponta
  a ponta em desktop/celular: Perfil → aviso → fila → decisão → Perfil atualizado.
- Mensagens, focus/teclado, transições e movimento reduzido seguem os componentes
  compartilhados existentes. A revisão nunca é confundida com login por WhatsApp.

## Publicação e verificação

Preparar backup, migrations necessárias, versões imutáveis de backend/frontend
e rollback. Publicar na VPS mantendo os demais sistemas. Conferir health,
permissões, notificações e a solicitação real #1 em modo leitura; executar a
recuperação de avisos com saída resumida. A decisão sobre o vínculo real cabe
ao usuário na nova tela. Não usar aprovação real como teste de deploy.

Este documento é o plano; sua criação não executa implementação, migração,
encaminhamento de mensagens nem decisões sobre solicitações.
