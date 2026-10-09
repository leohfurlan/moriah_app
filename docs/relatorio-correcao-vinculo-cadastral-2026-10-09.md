# Correção do fluxo de vínculo cadastral

## Comportamento entregue

Pedidos do Perfil são encaminhados por notificações internas aos administradores
e à secretaria da mesma igreja, incluindo o solicitante quando ele também possui
permissão de revisão. A entrada “Solicitações de vínculo” na gestão e o botão
“Revisar solicitações de vínculo” no Perfil sem membro abrem a fila. O aviso
também oferece acesso ao detalhe.

A aprovação exige escolher explicitamente um cadastro existente. A rejeição
exige motivo. Ambas registram responsável, data e auditoria e avisam o solicitante.
O Perfil consulta a conta novamente ao receber foco e atualiza o vínculo sem novo
login. Pedidos rejeitados mostram o motivo e permitem nova solicitação.

API e Django admin usam o mesmo serviço transacional. Bloqueios de conta e
cadastro impedem pedidos duplicados e disputas pelo mesmo membro. O fluxo não
altera cargos nem associa automaticamente por e-mail. O candidato por e-mail
é somente uma sugestão. Não foi necessário alterar o esquema do banco.

## Validação

- 258 testes backend aprovados em PostgreSQL isolado, incluindo concorrência real,
  isolamento entre igrejas, permissões, duplicação, aprovação/rejeição e Django admin.
- TypeScript e 12 testes mobile aprovados sobre o snapshot do commit.
- Quatro cenários de navegador com backend real local: administrador desktop,
  administrador mobile, rejeição e solicitante comum revisado em outra sessão.
  Incluem confirmação manual, Perfil atualizado, notificações e links de ação.
- As seis fases de QA funcional passaram: 92 verificações, nenhuma falha.
- Bundle final gerado do snapshot versionado. Alterações locais anteriores de
  layout/navegação e seus testes foram preservadas fora desta publicação.

## Operação

O comando `recover_member_link_notifications --church-id ID --dry-run` antecipa
os avisos faltantes. Sem `--dry-run`, cria apenas esses avisos para os pedidos
pendentes da igreja escolhida. Repeti-lo não duplica notificações e não aprova
solicitações. Avisos nesta entrega são internos ao app; não há envio de WhatsApp.

Para usar: abrir o sino ou Gestão → Solicitações de vínculo, conferir o pedido,
selecionar o cadastro correto e confirmar a decisão. Se nenhum cadastro existir,
a secretaria deve cadastrar a pessoa pelo fluxo autorizado de membros primeiro.

## Publicação confirmada

Backend e frontend publicados na revisão `1296bbaddfec` em 09/10/2026, após
backup verificado `20261009T113418Z`. Containers e readiness saudáveis; não houve
migração de esquema. Serviços Nexor consultados permaneceram respondendo HTTP 200.

A recuperação encontrou um pedido pendente e criou uma notificação. Uma segunda
execução criou zero avisos, confirmando a deduplicação. O pedido real #1 permanece
pendente, sem revisão, e o aviso está não lido para o administrador solicitante.

Validação no domínio público em desktop e celular confirmou Perfil pendente,
entrada da fila, detalhe do pedido e aviso visível. A conferência não aprovou,
rejeitou nem marcou a nova notificação como lida. Aviso e decisão reais ficam
disponíveis ao usuário.
