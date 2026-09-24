# Plano de execução do MVP — App Moriah

**Data:** 16/09/2026  
**Base:** Relatório de paridade — App Moriah × Mockup canônico  
**Status:** Fases 1 e 2 executadas e verificadas em 16/09/2026 — ver
`docs/qa/fase-1-confiabilidade-2026-09-16.md` e `docs/qa/fase-2-navegacao-2026-09-16.md`  
**Escopo:** `mobile/` e `backend/`

## 1. Objetivo

Tornar os fluxos centrais do App Moriah confiáveis, verdadeiros e navegáveis antes de ampliar a cobertura do mockup canônico.

O objetivo do MVP não é implementar imediatamente as 49 telas do mockup. A primeira etapa deve fechar os fluxos que já existem parcialmente e eliminar comportamentos que podem induzir o usuário ao erro.

## 2. Escopo do MVP

O MVP imediato compreende:

- autenticação;
- home/dashboard;
- agenda;
- contribuições;
- gestão financeira;
- escalas;
- perfil;
- notificações básicas.

As áreas de Escola Bíblica, repertório, bandas, palavras, família e diretório ficam para ondas posteriores. Elas exigem modelagem de domínio e contratos próprios; não devem ser representadas apenas por telas vazias.

## 3. Premissas e decisões necessárias

Antes da implementação, devem ser formalizadas:

1. quais funcionalidades pertencem ao MVP;
2. quais capacidades cada papel possui;
3. quais itens da sidebar serão exibidos, ocultados ou marcados como “Em breve”;
4. como o dashboard deve se comportar quando não houver dados;
5. qual é o escopo de tenant/igreja de cada consulta e operação;
6. quais estados de negócio são permitidos para contribuições e escalas.

### 3.1 Matriz inicial de capacidades

| Capacidade | Membro | Líder | Tesouraria | Admin |
|---|---:|---:|---:|---:|
| Ver dados próprios | Sim | Sim | Sim | Sim |
| Enviar contribuição | Sim | Sim | Sim | Sim |
| Aprovar contribuição | Não | Não | Sim | Sim |
| Criar e gerenciar escala | Não | A decidir | Não | Sim |
| Gerenciar membros | Não | A decidir | Não | Sim |

As células “A decidir” devem ser resolvidas antes da implementação dos guards de rota.

## 4. Ordem de execução

| Fase | Foco | Resultado esperado |
|---|---|---|
| 0 | Baseline e decisões | escopo, capacidades e evidências fechados |
| 1 | Confiabilidade P0 | operações visíveis, sem duplicação e sem dados falsos |
| 2 | Navegação | sidebar e tabs coerentes com as capacidades |
| 3 | Gestão financeira | aprovação de contribuições disponível no app |
| 4 | Escalas | criação, gestão, publicação e resposta funcionais |
| 5 | Fundamentos transversais | notificações, filtros, paginação e UX consistente |
| 6 | Domínios novos | expansão guiada por contratos de domínio |

---

## 5. Fase 0 — Baseline e decisões

**Prioridade:** P0  
**Estimativa:** 1–2 dias  
**Dependências:** nenhuma

### Atividades

- corrigir as métricas inconsistentes do relatório de paridade;
- registrar commit, versões, seed e ambiente usado no QA;
- criar a matriz de capacidades por papel;
- definir o escopo do MVP;
- classificar os itens da navegação como implementados, MVP, futuros ou removidos;
- confirmar escopo por igreja/tenant dos endpoints existentes;
- definir estados de dashboard sem dados;
- confirmar transições válidas de contribuição e escala.

### Entregáveis

- matriz de capacidades;
- inventário de rotas e navegação aprovado;
- decisão sobre dados ausentes no dashboard;
- baseline reproduzível do QA;
- lista de decisões pendentes de produto.

### Entregáveis — produzidos em 16/09/2026

| Entregável | Artefato |
|---|---|
| matriz de capacidades por papel | `docs/architecture/capacidades-mvp.md` |
| inventário de rotas e navegação classificado | `docs/architecture/navegacao-mvp.md` |
| decisões fechadas (escopo, dashboard sem dados, tenant, transições de estado) | `docs/fase-0-decisoes-2026-09-16.md` §1-4 |
| baseline reproduzível do QA | `docs/qa/baseline-2026-09-16.md` |
| lista de decisões pendentes de produto (D1–D8) | `docs/fase-0-decisoes-2026-09-16.md` §5 |
| errata de métricas do relatório de paridade | `docs/relatorio-paridade-mockup-vs-app-2026-09-16.md` (bloco "Errata de 16/09/2026") |

Resultado do gate: nenhuma capacidade nova foi aberta na Fase 0 — a lista de decisões D1–D8 é a
única pendência, e os padrões adotados em §5 permitem que a Fase 1 comece sem bloqueio.

### Gate de saída

Nenhuma nova tela ou rota deve ser criada sem estar associada a uma capacidade, um papel e um fluxo de aceite.

## 6. Fase 1 — Confiabilidade P0

**Prioridade:** P0  
**Estimativa:** 3–4 dias  
**Dependências:** Fase 0

### 6.1 Tratamento único de erros

- converter respostas JSON e HTML em erros tipados no cliente;
- nunca renderizar HTML bruto do backend;
- distinguir `401`, `403`, `404`, `422` e `500`;
- exibir mensagem em português e ação de recuperação quando aplicável.

### 6.2 Feedback in-app

- substituir as 14 chamadas a `Alert.alert` por componentes de feedback;
- usar `InlineNotice` para validação e erro contextual;
- usar `Toast` ou confirmação persistente para sucesso;
- manter o feedback visível até que o usuário consiga compreendê-lo.

### 6.3 Operações de escrita

- mover a navegação para depois do `await` bem-sucedido;
- bloquear o botão durante `submitting`;
- impedir reenvio enquanto a operação estiver em andamento;
- atualizar a tela depois da operação ou redirecionar para uma tela que reflita o novo estado.

### 6.4 Guards de rota e escrita

- impedir que membro monte o formulário de criação de escala;
- proteger telas administrativas por capacidade;
- manter o backend como autoridade final;
- exibir mensagem clara quando a conta não tiver vínculo de membro.

### 6.5 Rotas inválidas e música

- criar `app/+not-found.tsx` em PT-BR;
- exigir `scheduleId` em `/song/[id]`;
- redirecionar quando o contexto da escala faltar;
- tratar 404 da música sem chamar `/me/schedules/undefined/`.

### 6.6 Dashboard

- remover valores fixos apresentados como dados reais;
- usar dados reais quando houver endpoint confiável;
- usar “Sem dados disponíveis” quando o dado não existir;
- marcar explicitamente qualquer conteúdo de demonstração.

### Critérios de aceite da Fase 1

- membro tentando criar escala recebe erro visível de permissão;
- admin cria escala, recebe confirmação e vai para a agenda;
- múltiplos cliques não criam duplicidade;
- login inválido mostra erro;
- contribuição sem comprovante mostra validação;
- erros de API nunca exibem HTML do Django;
- rota inexistente abre uma página 404 em português;
- URL de música sem contexto não gera chamada com `undefined`;
- nenhum KPI operacional permanece hardcoded sem indicação de demonstração.

## 7. Fase 2 — Navegação e estrutura

**Prioridade:** P0/P1  
**Estimativa:** 2–3 dias  
**Dependências:** Fases 0 e 1

### Atividades

- criar uma única configuração de navegação, por exemplo `navigation.ts`;
- incluir em cada item `label`, `route`, `icon`, `capability`, `platform` e `status`;
- gerar sidebar desktop e tabs mobile a partir dessa configuração;
- corrigir o avatar e o nome do usuário;
- substituir o badge fixo do sino por contagem real ou remover o badge;
- implementar a busca global ou remover o campo decorativo;
- criar Configurações ou remover o item da navegação;
- alinhar as tabs mobile ao mockup aprovado;
- eliminar arrays duplicados em `Screen.tsx`.

### Regra para funcionalidades fora do MVP

Itens sem implementação devem ser:

- ocultados;
- ou exibidos como “Em breve”, sem simular um fluxo funcional.

Não devem apontar para uma tela existente apenas para evitar uma rota vazia.

### Critério de aceite

Todo item visível da sidebar ou das tabs deve levar a uma tela coerente com seu rótulo, respeitar a capacidade do usuário e ter estado de carregamento, vazio e erro.

## 8. Fase 3 — Gestão financeira

**Prioridade:** P1  
**Estimativa:** 4–6 dias  
**Dependências:** Fases 0–2

### Atividades

- criar tela de contribuições pendentes;
- adicionar filtros por período e status;
- criar detalhe da contribuição;
- implementar aprovação e rejeição;
- atualizar a lista após a decisão;
- exibir histórico e usuário responsável pela decisão;
- proteger as operações para tesouraria/admin;
- tratar estados de carregamento, erro e lista vazia.

### Validações do backend

Antes de fechar a UI, confirmar:

- transições permitidas de status;
- comportamento de aprovação duplicada;
- necessidade de motivo para rejeição;
- escopo por igreja/tenant;
- idempotência do endpoint;
- registro de auditoria.

### Critério de aceite

Uma contribuição aprovada no app deve aparecer com o novo status após reload, não deve ser reaprovada de forma inconsistente e deve manter registro da decisão.

## 9. Fase 4 — Escalas

**Prioridade:** P1  
**Estimativa:** 1–2 semanas  
**Dependências:** Fases 0–2; parte da Fase 3 pode ocorrer em paralelo

Esta fase deve ser dividida em três entregas verticais.

### 9.1 Gestão básica

- endpoint de listagem administrativa;
- escopo por igreja;
- criação com evento, ministério e horário;
- tela administrativa de escalas;
- edição e cancelamento;
- permissões por papel.

### 9.2 Formação da equipe

- funções;
- pessoas escaladas;
- detecção de conflitos;
- convites;
- resposta do membro;
- publicação.

### 9.3 Substituição

- solicitação de substituição;
- aprovação, se necessária;
- histórico da substituição;
- atualização da escala;
- notificação aos envolvidos.

### Fora do primeiro corte de escalas

Setlist, repertório, transposição, BPM e modo culto devem permanecer fora desta primeira entrega, salvo decisão explícita de que são indispensáveis ao fluxo principal.

### Critério de aceite

Um administrador consegue criar uma escala completa, selecionar pessoas, publicar e acompanhar as respostas. Um membro consegue visualizar e responder sem acessar dados de outra igreja.

## 10. Fase 5 — Fundamentos transversais

**Prioridade:** P1/P2  
**Estimativa:** 4–6 dias  
**Dependências:** Fases 1–4

### Atividades

- criar notificações persistentes;
- implementar contador real do sino;
- persistir “marcar como lida”;
- adicionar paginação às listas de crescimento previsível;
- adicionar filtros de contribuições, escalas, eventos e notificações;
- usar date/time pickers em escala, agenda e contribuição;
- normalizar acentos e mensagens;
- remover requisições anônimas desnecessárias no boot;
- tratar contas sem vínculo de membro;
- revisar warnings de estilo.

### Critério de aceite

Os estados exibidos após reload devem corresponder ao backend. Nenhuma ação persistente pode depender apenas de estado local em memória.

## 11. Fase 6 — Domínios novos

Cada domínio deve começar por modelagem, permissões e contrato de API. Não criar apenas shells de navegação.

### Ordem sugerida

1. Escola Bíblica, turmas e inscrições;
2. repertório, bandas, setlists e modo culto;
3. palavras/conteúdo;
4. diretório e perfil público;
5. família e vínculos;
6. privacidade, preferências e ajuda;
7. relatórios financeiros e exportações.

Cada domínio precisa de:

- modelo de dados;
- permissões;
- endpoints;
- estados vazios e de erro;
- critérios de aceite;
- uma fatia vertical completa antes da expansão.

## 12. Trilha de segurança e operação

Os itens abaixo devem ser avaliados separadamente da paridade visual e não devem ser classificados automaticamente como P2:

- recuperação e troca de senha;
- logout e invalidação de token;
- exposição de páginas de debug;
- auditoria de ações sensíveis;
- escopo de tenant em todas as consultas;
- cancelamento de escala quando houver impacto operacional.

A prioridade final deve ser definida por risco, dados envolvidos e requisitos de lançamento.

## 13. Definition of Done

Uma atividade só será considerada concluída quando:

- funcionar para os papéis relevantes;
- tratar `loading`, vazio, sucesso, `401`, `403`, `404`, `422` e erro de servidor conforme aplicável;
- possuir teste automatizado ou reprodução documentada;
- tiver sido validada em desktop e mobile quando a tela for compartilhada;
- não apresentar dados fictícios como reais;
- não usar `Alert.alert` para feedback de produto;
- não expor HTML ou página de debug ao usuário;
- possuir evidência anexada ao ticket ou ao relatório;
- não tiver sido promovida para produção sem autorização explícita.

## 14. Evidências e reprodução

Cada entrega deve atualizar os artefatos de QA existentes ou criar evidência equivalente:

- inventário do mockup;
- inventário do backend;
- varredura de rotas;
- fluxos de escrita;
- fluxo mobile;
- screenshots relevantes;
- comando de reprodução;
- resultado por papel e viewport.

O baseline deve registrar commit, versões, URLs, seed e data/hora do teste. Testes que escrevem dados devem usar banco isolado ou rotina de limpeza verificável.

## 15. Sequenciamento resumido

| Período aproximado | Foco | Entrega |
|---|---|---|
| Dias 1–2 | Baseline | escopo, capacidades e regras fechados |
| Dias 3–6 | P0 | feedback, guards, rotas inválidas e dashboard verdadeiro |
| Dias 7–8 | Navegação | sidebar/tabs coerentes |
| Semana 2 | Financeiro | aprovação de contribuições no app |
| Semanas 3–4 | Escalas | gestão, publicação e respostas |
| Semana 5 | Transversal | notificações, filtros, paginação e pickers |
| Após o MVP | Domínios novos | expansão conforme decisões de produto |

As durações são ordem de execução, não compromisso de prazo. O avanço entre fases depende dos critérios de aceite e das decisões de produto.
