# Moriah App — Status do sistema e plano de evolução

**Diagnóstico técnico · Igreja Moriah**

- **Data:** 06 de julho de 2026
- **Escopo:** Backend (Django/DRF), Mobile (Expo/React Native), UX/UI
- **Base de comparação:** PRD_Moriah_App_v1.md (Jun/2026)

---

## Onde o projeto está

O código percorre as fases 0 a 5 do plano do próprio PRD. A Fase 6 (piloto interno) ainda não foi iniciada — é o que separa o sistema de um uso real com a igreja.

| Fase | Descrição | Status |
|---|---|---|
| Fase 0 | Preparação | ✅ Concluída |
| Fase 1 | Base do Backend | ✅ Concluída |
| Fase 2 | Membresia & Células | ✅ Concluída |
| Fase 3 | Financeiro c/ Comprovantes | 🟡 Parcial |
| Fase 4 | App Mobile MVP | 🟡 Parcial |
| Fase 5 | Escalas | ✅ Concluída |
| Fase 6 | Piloto Interno | ⚪ Não iniciada |

---

## Backend — Django + DRF

Os 8 apps do domínio previstos no PRD existem e têm models, admin e (na maioria) API própria. A estrutura é fiel ao que foi planejado.

### `accounts` — ✅ Implementado
User customizado por e-mail com 7 papéis (admin, pastor, secretaria, tesoureiro, líder de célula, coordenador, membro), JWT via SimpleJWT, permissões `IsTreasurerOrAdmin` e `IsCellLeaderOrAdmin`.

### `members` — ✅ Implementado
Member, Family e FamilyRelationship completos, com status (ativo/visitante/inativo/transferido/falecido) e vínculo a célula. CRUD via Django Admin, conforme decisão do PRD.

### `cells` — ✅ Implementado
Cell, CellMeeting, CellAttendance. Endpoint do líder para listar membros da própria célula e registrar reunião com presença.

### `finance` — 🟡 Parcial
Contribution + ContributionAttachment com as 4 situações do PRD (pending/approved/rejected/needs_review) e 6 categorias. Admin com destaque visual de pendências e upload multi-arquivo funcionando.
- **Lacuna:** nenhuma validação de tamanho ou tipo de arquivo no serializer — qualquer upload passa.

### `ministries` — ✅ Implementado
Ministry e MinistryRole com M2M para membros. Sem app dedicado de views/serializers — consumido hoje via Django Admin e como referência em schedules.

### `events` — ✅ Implementado
Event com tipo, data/hora, local — base para escalas, como previsto. Gestão via Admin.

### `schedules` — ✅ Implementado
Schedule + ScheduleAssignment com confirmação/recusa e justificativa. Endpoint do membro para listar e agir sobre suas escalas. Admin com filtro por status e ministério para acompanhamento.

### `audit` — ⛔ Não conectado
AuditLog existe como model e está registrado no Admin, mas nenhuma view, signal ou `save()` em outro app grava nele. O PRD exige trilha de auditoria para dados financeiros e de membros — hoje isso não acontece em nenhum lugar do código.

---

## Mobile — Expo + React Native + TypeScript

7 telas cobrindo o fluxo principal do membro. A base de autenticação e chamadas HTTP é simples e direta, sem gerenciamento de estado global — adequado para o tamanho atual do app.

| Métrica | Valor |
|---|---|
| Telas de fluxo | 6 |
| Componentes de UI compartilhados | 2 |
| Testes automatizados | 0 |
| Refresh automático de token | Não implementado |

### Login & sessão — ✅ Implementado
Login por e-mail/senha, tokens salvos localmente, hook `useAuth` carrega o perfil ao abrir o app. Sem refresh automático de token de acesso — expira e força novo login (já sinalizado como próximo passo pelo próprio README).

### Home, Perfil — ✅ Implementado
Home com atalhos para as 4 ações do membro. Perfil mostra célula, telefone, e-mail e ministérios — cobre a necessidade da Fase 4 sem uma tela dedicada de "Minha Célula".

### Nova Contribuição — 🟡 Parcial
Seleção de imagem (câmera/galeria) e documento, múltiplos anexos, envio multipart funcionando de ponta a ponta.
- **Lacuna:** só expõe 2 das 6 categorias do backend (Dízimo, Oferta) — Campanha, Missões, Evento e Outros ficam inacessíveis pelo app.

### Minha Escala, Extrato — ✅ Implementado
Lista de escalas com confirmação/recusa e campo de justificativa; extrato lista contribuições com status. Fluxo fiel ao critério de aceite da Fase 5 do PRD.

---

## UX / UI

Existe um sistema visual mínimo consistente — não é "sem estilo", mas também não está pronto para publicação nas lojas.

### Sistema visual — ✅ Consistente
Paleta neutra clara única, cartões com borda suave, botão primário/secundário padronizado em `Form.tsx` e `Screen.tsx`. Uso correto de `accessibilityRole`/`accessibilityState` nos seletores de categoria.

### Identidade & publicação — ⛔ Pendente
`app.json` não define ícone, splash screen, nem identificadores de pacote Android/iOS. O app roda no Expo Go, mas não está configurado para build de produção (EAS Build).

### Estados de carregamento e erro — 🟡 Básico
Erros de rede aparecem como `Alert` com o texto cru da exceção — funcional, mas não é uma mensagem pensada para o usuário final (ex: "sessão expirada, faça login novamente").

---

## Lacunas e riscos antes de um piloto real

1. **⛔ Nenhum teste automatizado** — Zero arquivos de teste no backend e no mobile, e nenhuma pipeline de CI. Qualquer regressão em login, upload de comprovante ou confirmação de escala só é percebida manualmente.
2. **⛔ Auditoria exigida pelo PRD não está implementada** — O model AuditLog existe mas nada grava nele. Alterações financeiras e de membros — que o PRD trata como requisito mínimo de segurança/LGPD — não deixam rastro hoje.
3. **⚠ Sessão expira sem aviso** — Sem refresh automático de token, o membro é derrubado silenciosamente após o tempo configurado (60 min por padrão) e precisa logar de novo sem entender o motivo.
4. **⚠ Upload sem validação** — Nenhum limite de tipo de arquivo ou verificação de conteúdo no envio de comprovantes — qualquer extensão é aceita pelo serializer.
5. **⚠ App não está pronto para as lojas** — Falta ícone, splash, identificadores de bundle e configuração de build — hoje só roda via Expo Go em desenvolvimento.

---

## Próximos passos propostos

Organizados por urgência, não por tamanho — o objetivo é chegar à Fase 6 (piloto interno) do PRD com segurança.

### Antes de qualquer piloto com dados reais

- **Conectar o AuditLog** — Signals ou `save()` explícito em Contribution, Member e ScheduleAssignment para gravar quem alterou o quê — requisito de segurança do próprio PRD, não um "nice to have".
- **Refresh automático de token** — Interceptar 401 no serviço de API e renovar com o refresh token salvo, sem derrubar a sessão do membro.
- **Validação de upload** — Restringir extensão/mimetype e tamanho máximo de comprovantes no serializer do finance.

### Para fechar o MVP conforme o PRD

- **Expor as 6 categorias de contribuição no app** — Hoje só Dízimo e Oferta aparecem na tela de Nova Contribuição; Campanha, Missões, Evento e Outros já existem no backend.
- **Testes de API e permissões** — Cobrir ao menos os fluxos críticos: login, criação de contribuição, ação de escala e isolamento de dados entre membros (um membro não pode ver extrato de outro).
- **Mensagens de erro voltadas ao usuário** — Substituir o texto cru da exceção nos Alerts por mensagens específicas (sessão expirada, arquivo inválido, sem conexão).

### Para rodar a Fase 6 (piloto interno) do PRD

- **Identidade visual e build de produção** — Ícone, splash screen, bundle identifiers e configuração de EAS Build para gerar um app instalável fora do Expo Go.
- **Storage S3/R2 e backup** — Trocar o FileField local por storage compatível com S3 antes de homologação, e definir rotina de backup do Postgres.
- **Treinamento de secretaria, tesouraria e líderes** — Roteiro curto de uso do Django Admin para quem vai operar o sistema no dia a dia — a interface é funcional, mas não foi pensada para usuário leigo.

---

*Avaliação baseada em leitura direta do código em `backend/apps/*` e `mobile/src|app`, comparado ao PRD_Moriah_App_v1.md. Sem execução de testes em runtime nesta rodada.*
