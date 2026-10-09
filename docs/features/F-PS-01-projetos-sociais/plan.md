# Plano F-PS-01 — Projetos Sociais

Status: **draft exploratório**  
ID da feature: **F10 — Projetos Sociais**  
Diretório legado dos artefatos: `F-PS-01-projetos-sociais`  
Especificação: [`spec.md`](spec.md) · Contrato: [`contract.md`](contract.md)  
PRD: [`PRD_Moriah_App_v1.md`](../../../PRD_Moriah_App_v1.md), v1.1

Este plano descreve ondas de execução, não autoriza implementação, migration,
deploy ou abertura/publicação de tickets.

## 1. Pré-condições e decisões

Antes da implementação:

1. Confirmar se o primeiro release suporta múltiplos projetos.
2. Confirmar tratamento de menores, responsáveis e consentimento.
3. Confirmar escopo de recursos: inventário, orçamento, doações ou combinação.
4. Confirmar matriz de papéis e acesso a dados sensíveis.
5. Confirmar que WhatsApp é uma barreira de prioridade/sequenciamento, não uma
   dependência técnica obrigatória para o domínio social.

O PRD v1.1 cataloga WhatsApp como F09 e Projetos Sociais como F10. A
implementação social deve permanecer posterior à integração com WhatsApp por
decisão de prioridade do produto.

## 2. Ondas propostas

### Onda 0 — Alinhamento de produto e contratos

**Resultado:** feature deixa de ser draft.  
**Dependências:** decisões da seção 1 e contrato do WhatsApp quando houver
integração relevante.  
**Checkpoint:** PRD atualizado, ID confirmado, `spec.md` e `contract.md`
revisados, sem decisões bloqueadoras.

### Onda 1 — Núcleo social administrativo

**Resultado:** cadastro de projetos, estados, beneficiários, voluntários,
atribuições e isolamento por igreja.  
**Dependências:** Accounts/Church, Members opcional e autorização social.  
**Checkpoint:** testes de permissão, identidade externa, ciclo do projeto e
auditoria passam.

### Onda 2 — Operação de turmas e atividades

**Resultado:** turmas/ciclos, inscrições, atividades, presença e agenda
operacional.  
**Dependências:** núcleo da Onda 1; contrato de Events/Agenda acordado.  
**Checkpoint:** fluxo completo de inscrição → atividade → presença, incluindo
   concorrência e encerramento.

### Onda 3 — Grade curricular e Conteúdo

**Resultado:** módulos e encontros ordenados, com referência opcional a
conteúdo existente.  
**Dependências:** Content provider e política para conteúdo arquivado ou não
publicado.  
**Checkpoint:** conteúdo não vaza entre igrejas e seu ciclo editorial não é
alterado por uma atividade social.

### Onda 4 — Recursos e indicadores

**Resultado:** inventário, movimentações, consumo e relatórios básicos.  
**Dependências:** decisão sobre saldo negativo, orçamento e dados financeiros.  
**Checkpoint:** saldo consistente, movimentos auditados e relatórios com
escopo correto.

### Onda 5 — Experiência mobile e integrações posteriores

**Resultado:** telas mobile para voluntários/gestores e eventual integração com
WhatsApp.  
**Dependências:** contratos das ondas anteriores, matriz de dados mínimos e
integração WhatsApp disponível.  
**Checkpoint:** jornada real em desktop/mobile, sem ampliar o acesso de
beneficiários ou voluntários além do contrato.

## 3. Estratégia de implementação e verificação

Cada onda deve entregar uma fatia observável e seus testes antes da seguinte.
Migrations, APIs e telas devem seguir os módulos e padrões já existentes em
`backend/apps/` e `mobile/`, mas os caminhos exatos permanecem decisão de
implementação após aprovação do contrato.

Gates obrigatórios ao final de uma implementação aplicável:

- `python -m pytest -q` em `backend/`;
- schema OpenAPI com `config.settings_test`;
- `python manage.py check` com `config.settings_test`;
- `npm run typecheck` em `mobile/` quando houver alteração mobile;
- `git diff --check` na raiz;
- cenários de isolamento por igreja, permissões, auditoria e integração real
  com providers existentes.

Os gates acima estão configurados no repositório, mas não foram executados
porque esta entrega contém somente documentação.

## 4. Definition of done proposta

A feature só estará pronta para implementação quando:

- o PRD tiver ID, prioridade, dependências e critérios de aceite aprovados;
- `spec.md`, `contract.md` e `plan.md` estiverem confirmados;
- os papéis e dados sensíveis tiverem dono definido;
- houver contrato acordado para Members, Content e Events quando consumidos;
- a integração WhatsApp tiver sido concluída conforme a prioridade definida;
- tickets puderem ser derivados sem decisões bloqueadoras.

A implementação só estará concluída quando os testes e gates aplicáveis
passarem. A integração só estará pronta quando houver evidência ponta a ponta
com dados controlados, incluindo isolamento por igreja e auditoria.

## 5. Tamanho e dependências

Esta feature não deve ser iniciada em paralelo com a integração WhatsApp sem
uma decisão explícita de prioridade. Depois que a prioridade for liberada,
Onda 1 pode começar isoladamente; Ondas 2–4 dependem dos contratos internos;
Onda 5 depende da disponibilidade dos providers e da validação da experiência
real.
