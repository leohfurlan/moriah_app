# Do diagnóstico ao piloto interno

**Plano de desenvolvimento · Igreja Moriah**

- **Data:** 06 de julho de 2026
- **Base:** [Relatório de status de 06/07/2026](../relatorio-status-2026-07-06.md)
- **Horizonte:** 3 sprints de 2 semanas · 6 semanas

Critério de priorização: primeiro o que **reduz risco** (segurança, auditoria, sessão), depois o que **completa o MVP** já prometido no PRD, e por último o que **viabiliza operação real** com a igreja. Cada sprint entrega algo utilizável — nenhum sprint é só "arrumação".

---

## Visão geral

| Sprint | Datas | Tema | Foco |
|---|---|---|---|
| Sprint 1 | 06/07 – 19/07/2026 | Confiabilidade e segurança | Fecha os riscos que impedem qualquer piloto com dados reais. |
| Sprint 2 | 20/07 – 02/08/2026 | Completar o MVP | Alinha o app ao que o PRD prometeu e cobre as regras de permissão com testes. |
| Sprint 3 | 03/08 – 16/08/2026 | Pronto para o piloto | Identidade, storage, backup e treinamento — a Fase 6 do PRD. |

---

## Sprint 1 — Confiabilidade e segurança
**06/07 – 19/07/2026**

Estes quatro itens foram os riscos críticos e de atenção do relatório. Nenhum é grande isoladamente, mas juntos removem os riscos que tornariam um piloto real irresponsável de se conduzir.

### Conectar o AuditLog — `Urgente` `Backend`
- **O que fazer:** Adicionar signals (ou `save()` explícito) em `Contribution` (mudança de status), `Member` (edição de dados) e `ScheduleAssignment` (confirmação/recusa) para gravar em `AuditLog`: usuário, ação, model, e payload da mudança.
- **Resultado / impacto:** Requisito de segurança do próprio PRD (seção 13) passa a existir de fato — hoje o model está vazio.
- **Prazo:** 3 dias úteis

### Refresh automático de token — `Urgente` `Mobile`
- **O que fazer:** No `services/api.ts`, interceptar resposta 401, tentar renovar com o refresh token salvo em `storage.ts` via `/api/auth/refresh/` e repetir a chamada original; só deslogar se o refresh também falhar.
- **Resultado / impacto:** Elimina o principal ponto de atrito hoje: o membro sendo derrubado sem entender por quê.
- **Prazo:** 2 dias úteis

### Validação de upload de comprovante — `Urgente` `Backend`
- **O que fazer:** No `ContributionSerializer`, validar extensão/mimetype (jpg, png, pdf) e tamanho máximo (ex: 8MB) de cada arquivo antes de criar o `ContributionAttachment`.
- **Resultado / impacto:** Fecha uma porta aberta de segurança antes de expor o envio de arquivos a usuários reais.
- **Prazo:** 1 dia útil

### Fundação de testes automatizados — `Alto valor` `Backend`
- **O que fazer:** Configurar pytest-django e escrever os 2 testes de maior risco: login (credenciais corretas/incorretas) e isolamento de extrato (membro A não acessa contribuição de membro B).
- **Resultado / impacto:** Cria a rede de segurança mínima antes de qualquer mudança futura — sem isso, todo sprint seguinte é mais arriscado.
- **Prazo:** 2 dias úteis

> **Critério de conclusão do sprint:** Uma alteração em membro, contribuição ou escala gera registro de auditoria; o membro não é mais deslogado por expiração de token durante o uso normal; upload rejeita arquivo fora do padrão; existe suíte de testes rodando via `pytest` cobrindo login e isolamento de dados.

---

## Sprint 2 — Completar o MVP do PRD
**20/07 – 02/08/2026**

Com a base estabilizada, este sprint fecha as diferenças entre o que o PRD prometeu e o que o app hoje entrega, e estende a cobertura de testes às regras de permissão por papel.

### Expor as 6 categorias de contribuição no app — `Alto valor` `Mobile`
- **O que fazer:** Em `NewContributionScreen.tsx`, adicionar Campanha, Missões, Evento e Outros à lista `contributionCategories` — já existem no backend, só faltam na UI.
- **Resultado / impacto:** Evita que o membro categorize errado (ex: registrar campanha como oferta), reduzindo retrabalho da tesouraria — objetivo central do PRD.
- **Prazo:** 1 dia útil

### Mensagens de erro voltadas ao usuário — `Alto valor` `Mobile`
- **O que fazer:** Mapear os erros mais comuns (401, sem rede, arquivo grande/inválido) para mensagens específicas em português, substituindo o texto cru da exceção nos `Alert` de cada tela.
- **Resultado / impacto:** Reduz confusão do membro leigo e a tentação de voltar a resolver pelo WhatsApp — o problema que o PRD existe para resolver.
- **Prazo:** 2 dias úteis

### Testes de permissão por papel — `Alto valor` `Backend`
- **O que fazer:** Cobrir com testes as regras da seção 6 do PRD: líder de célula só vê membros da própria célula; tesoureiro pode aprovar contribuição, membro comum não; membro só confirma/recusa a própria escala.
- **Resultado / impacto:** As regras de permissão descritas no PRD hoje não têm nenhuma verificação automatizada — um bug de permissão exporia dados financeiros ou pastorais indevidamente.
- **Prazo:** 3 dias úteis

> **Critério de conclusão do sprint:** O membro consegue registrar qualquer uma das 6 categorias de contribuição pelo app; erros comuns aparecem em linguagem clara; testes automatizados comprovam que cada papel (membro, líder, tesoureiro) só acessa o que o PRD permite.

---

## Sprint 3 — Pronto para o piloto interno
**03/08 – 16/08/2026**

Última etapa antes da Fase 6 do PRD: sair do ambiente de desenvolvimento e tornar o sistema operável por pessoas reais, fora da máquina de quem programou.

### Identidade visual e build de produção — `Alto valor` `Mobile`
- **O que fazer:** Definir ícone e splash screen, configurar `bundleIdentifier`/`package` Android/iOS em `app.json`, e configurar EAS Build para gerar um instalável.
- **Resultado / impacto:** Pré-requisito para qualquer membro instalar o app fora do Expo Go — sem isso não existe piloto mobile real.
- **Prazo:** 3 dias úteis

### Storage S3/R2 para comprovantes — `Infra`
- **O que fazer:** Trocar o `FileField` local por `django-storages` apontando para S3 ou Cloudflare R2 em homologação/produção, mantendo storage local só em dev.
- **Resultado / impacto:** Evita perda de comprovantes em redeploy ou troca de servidor — hoje os arquivos vivem só no disco local.
- **Prazo:** 2 dias úteis

### Rotina de backup do Postgres — `Infra`
- **O que fazer:** Script de `pg_dump` agendado (cron ou equivalente do provedor) com retenção de pelo menos 30 dias, e um teste manual de restauração.
- **Resultado / impacto:** Mitiga o risco mais grave possível: perda de dados de membros e financeiro sem cópia de segurança.
- **Prazo:** 1 dia útil

### Roteiro de treinamento operacional — `Operação`
- **O que fazer:** Documento curto (1-2 páginas) e uma sessão prática de 1h para secretaria, tesouraria e líderes de célula sobre o Django Admin: cadastrar membro, aprovar contribuição, registrar reunião de célula.
- **Resultado / impacto:** Critério de aceite explícito da Fase 6 do PRD — a interface é funcional, mas ninguém na igreja foi treinado nela ainda.
- **Prazo:** 2 dias úteis

> **Critério de conclusão do sprint:** Existe um build instalável do app fora do Expo Go; comprovantes ficam salvos em storage externo; existe backup automático testado; secretaria, tesouraria e ao menos um líder de célula já usaram o Admin com acompanhamento.

---

## Marco: piloto interno pode começar

**A partir de 17/08/2026** — Fase 6 do PRD: uso real com dados controlados, ajustes de UX e correção de bugs em campo.

---

*Plano derivado do relatório de status de 06/07/2026, priorizando risco de segurança/confiabilidade antes de completude, e completude antes de operação. Prazos assumem dedicação de um desenvolvedor full-stack em tempo parcial/integral equivalente a este escopo.*
