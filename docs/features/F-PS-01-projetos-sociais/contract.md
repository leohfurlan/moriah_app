# Contrato F-PS-01 — Projetos Sociais

Status: **draft exploratório**  
ID da feature: **F10 — Projetos Sociais**  
Diretório legado dos artefatos: `F-PS-01-projetos-sociais`  
Revisão do contrato: **0.1**  
PRD: [`PRD_Moriah_App_v1.md`](../../../PRD_Moriah_App_v1.md), v1.1  
Especificação: [`spec.md`](spec.md)

Este documento descreve a fronteira proposta para implementação e testes. Não
é um contrato aprovado nem autoriza migrations, endpoints ou publicação.

## 1. Proprietários e consumidores

| Provedor | Consumidor | Capacidade | Dono dos dados/IDs | Dependência | Prontidão |
| --- | --- | --- | --- | --- | --- |
| Accounts/Church | Social Projects | igreja, usuário e capacidades | `accounts` | base obrigatória | Implementado; autorização social não existe |
| Members | Social Projects | vínculo opcional com membro | `members.Member` | opcional | Implementado; sem deduplicação social |
| Content | Social Projects | referência opcional a material | `content.Content` | opcional | Implementado; política de conteúdo aplicado pendente |
| Events/Agenda | Social Projects | agenda de atividade | `events.Event` e agenda pessoal | opcional | Implementado parcialmente; contrato social pendente |
| Audit | Social Projects | trilha de alterações | `audit.AuditLog` | obrigatório | Implementado; ações sociais ainda não existem |
| Social Projects | Admin/API/Mobile | cadastro e operação social | novo domínio | futuro | Não implementado |
| WhatsApp | Social Projects | notificações externas futuras | futuro provedor | posterior à integração | Fora do contrato 0.1 |

## 2. Identidade e ownership

- Cada registro social pertence a uma `Church` dona.
- IDs de igreja, usuário e membro são fornecidos pelos domínios existentes;
  Social Projects não os recria.
- O ID de beneficiário é propriedade de Social Projects e não deve ser usado
  para inferir um `Member`.
- O ID de voluntário externo é propriedade de Social Projects; o vínculo com
  `Member` é opcional.
- O ID de conteúdo referenciado é propriedade de Content e deve ser validado
  pela igreja e pela política de acesso do conteúdo.
- O ID de evento eventualmente referenciado é propriedade de Events; atividade
  social não deve assumir que todo evento da igreja é uma atividade social.

## 3. Operações de domínio propostas

Estas operações são a interface mínima independente de transporte. Um endpoint
HTTP só deve ser definido após confirmação da decisão de produto e do padrão de
API.

### `create_project`

Entrada mínima: igreja autenticada, nome, objetivo e estado inicial permitido.  
Resultado: projeto criado com ID Social Projects e auditoria.  
Falhas: usuário sem capacidade, igreja ausente/inválida ou dados obrigatórios
inválidos.

### `register_beneficiary`

Entrada: projeto, identidade mínima do beneficiário, dados de contato e
responsável quando exigido pela política.  
Resultado: beneficiário criado ou vínculo explícito com registro existente.  
Falhas: projeto fora do escopo, duplicidade inequívoca, consentimento ausente
quando obrigatório ou dados inválidos.

### `assign_volunteer`

Entrada: projeto, pessoa interna ou externa, função e validade.  
Resultado: atribuição ativa e auditada.  
Falhas: pessoa inexistente, função inválida, sobreposição proibida ou usuário
sem escopo.

### `enroll_beneficiary`

Entrada: projeto, beneficiário, turma/ciclo e período.  
Resultado: inscrição ativa única por combinação definida pelo domínio.  
Falhas: projeto não ativo, beneficiário fora da igreja, inscrição equivalente
ativa ou capacidade da turma excedida se essa regra for aprovada.

### `record_activity`

Entrada: projeto, data/hora, tipo, turma opcional, responsáveis e conteúdo
opcional.  
Resultado: atividade persistida e disponível para presença.  
Falhas: projeto pausado/encerrado, responsável não atribuído ou conteúdo
inexistente/fora do escopo.

### `record_attendance`

Entrada: atividade, beneficiário ou voluntário, estado de presença e observação
permitida.  
Resultado: uma presença vigente por pessoa e atividade, com auditoria.  
Falhas: pessoa não inscrita/atribuída, atividade inexistente, escopo inválido
ou atualização concorrente incompatível.

### `move_resource`

Entrada: projeto, recurso, tipo de movimento, quantidade, unidade e motivo.  
Resultado: saldo consistente e movimento auditado.  
Falhas: quantidade inválida, saldo insuficiente conforme política aprovada,
recurso de outra igreja ou concorrência que invalide o saldo.

## 4. Regras de autorização

1. Toda operação recebe contexto autenticado com `user_id` e `church_id`.
2. A autorização deve validar capacidade social e escopo do projeto antes de
   carregar ou modificar dados sensíveis.
3. Falha de existência e falha de acesso a outra igreja devem ter resultado
   indistinguível para não vazar IDs ou contagens.
4. A existência de `member_profile` não concede, por si só, acesso a dados
   sociais administrativos.
5. Um voluntário só pode ver o mínimo necessário para suas atividades; notas
   sensíveis e relatórios agregados exigem capacidade específica.

## 5. Estados e consistência

- Projeto: `draft -> active -> paused -> active -> closed`, com transições
  proibidas definidas antes da implementação.
- Inscrição: `pending -> active -> completed/cancelled`.
- Atribuição de voluntário: `pending -> active -> ended`.
- Atividade: `planned -> completed/cancelled`.
- Movimentação de recurso: operação atômica; não pode produzir saldo negativo
  sem regra explícita.
- Presença: operação idempotente por atividade e participante; uma segunda
  entrega deve atualizar de forma auditável ou ser rejeitada conforme decisão.

## 6. Compatibilidade e testes de contrato

O contrato 0.1 não altera os contratos existentes de Members, Content, Events,
Audit ou WhatsApp. Qualquer mudança que transforme um vínculo opcional em
obrigatório, exponha novos dados a membros ou reutilize o Financeiro exige
revisão de contrato e aprovação coordenada.

Testes de contrato necessários quando implementado:

- autorização positiva e negativa por igreja e projeto;
- beneficiário externo sem `Member`;
- vínculo explícito com `Member` sem criação duplicada;
- conteúdo e evento de outra igreja rejeitados;
- presença duplicada/concorrente sem duas presenças vigentes;
- movimento de recurso sem saldo inconsistente;
- auditoria contendo ator, igreja, objeto e mudança relevante;
- schema OpenAPI refletindo campos, nulabilidade e erros aprovados.

Nenhum teste de produtor, consumidor ou integração foi executado para este
contrato draft.
