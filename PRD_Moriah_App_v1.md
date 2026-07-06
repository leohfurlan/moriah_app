# PRD — Plataforma de Gestão Moriah

**Produto:** Moriah App  
**Igreja:** Igreja Moriah  
**Versão:** v1.0 — MVP replanejado  
**Data:** Junho/2026  
**Responsável:** Leonardo Furlan  
**Objetivo:** criar uma plataforma própria para gestão de membresia, contribuições, células, eventos e escalas de ministérios da Igreja Moriah.

---

## 1. Resumo Executivo

A Igreja Moriah precisa reduzir a dependência de WhatsApp, planilhas, fichas físicas e controles manuais para atividades administrativas e ministeriais.

O sistema proposto será uma plataforma interna composta por:

- **Painel web administrativo** para liderança, secretaria, tesouraria e coordenadores.
- **App mobile** para membros, líderes de célula e voluntários.
- **Base única de membresia**, células, ministérios, escalas e contribuições.
- **Fluxo estruturado para envio e validação de comprovantes Pix**.

A primeira versão não deve tentar copiar todos os recursos de soluções como eNuvem. O foco inicial deve ser resolver as dores mais frequentes da Moriah com um MVP simples, utilizável e seguro.

---

## 2. Problema

Hoje, boa parte da gestão da igreja tende a ficar espalhada em canais diferentes:

- Fichas de membros em papel ou planilhas.
- Comprovantes de dízimos e ofertas enviados por WhatsApp.
- Escalas de louvor, dança, recepção, teatro, ministério infantil e técnica montadas manualmente.
- Confirmações de presença perdidas em grupos.
- Informações de células sem histórico organizado.
- Pouca rastreabilidade entre membro, célula, ministério, escala e contribuição.

O problema central não é apenas falta de software. É falta de uma **fonte única de verdade** para a operação da igreja.

---

## 3. Objetivos do Produto

### Objetivo principal

Criar uma plataforma própria da Igreja Moriah para centralizar a gestão de membros, células, contribuições, eventos e escalas ministeriais.

### Objetivos específicos

- Organizar a base de membros e famílias.
- Controlar células, líderes e frequência.
- Permitir que membros enviem comprovantes de dízimos/ofertas pelo app.
- Dar ao tesoureiro um painel de validação dos comprovantes.
- Permitir que o membro consulte seu próprio extrato.
- Organizar escalas de ministérios com confirmação ou recusa.
- Reduzir retrabalho administrativo.
- Criar uma base preparada para módulos futuros: Pix integrado, OCR, Moriah Kids, eventos pagos, Escola Bíblica e notificações.

---

## 4. Escopo do MVP

O MVP precisa ser menor, direto e funcional. A primeira versão deve validar uso real antes de avançar para automações mais complexas.

### Incluído no MVP

1. **Autenticação e permissões**
   - Login de administradores e membros.
   - Perfis de acesso por função.
   - Separação entre membro, líder, tesoureiro, secretário, coordenador e pastor.

2. **Membresia**
   - Cadastro de membros.
   - Cadastro de famílias.
   - Vínculo entre membros, cônjuge, filhos e responsáveis.
   - Situação: ativo, visitante, inativo, transferido, falecido.
   - Campos básicos: nome, telefone, e-mail, data de nascimento, endereço, estado civil, célula e ministérios.

3. **Células**
   - Cadastro de células.
   - Líderes e auxiliares.
   - Dia, horário e local.
   - Vínculo de membros à célula.
   - Relatório simples de reunião: data, presentes, visitantes e observações.

4. **Financeiro básico**
   - Cadastro de contribuições: dízimo, oferta, campanha e outros.
   - Envio de comprovante pelo membro.
   - Preenchimento manual de valor, data e categoria.
   - Anexo de imagem ou PDF.
   - Status: pendente, validado, recusado.
   - Validação pelo tesoureiro.
   - Extrato individual para o membro.
   - Painel de contribuições para tesouraria.

5. **Escalas de ministérios**
   - Cadastro de ministérios.
   - Cadastro de funções por ministério.
   - Criação de evento/culto.
   - Escala por função.
   - Confirmação ou recusa do membro.
   - Histórico simples de participação.

6. **Painel administrativo web**
   - Usar Django Admin customizado no início.
   - Operação por secretaria, tesouraria e liderança.

7. **App mobile inicial**
   - Login.
   - Perfil do membro.
   - Meu extrato.
   - Enviar comprovante.
   - Minha escala.
   - Confirmar ou recusar escala.

### Fora do MVP

Estes recursos são importantes, mas devem entrar depois:

- OCR automático de comprovante Pix.
- Pix dinâmico por API.
- Pagamento por cartão.
- Conciliação bancária OFX.
- Moriah Kids completo.
- Escola Bíblica completa.
- Eventos pagos.
- Push notifications avançadas.
- Chat interno.
- Ranking de regularidade de dízimos.
- Dashboards pastorais avançados.
- Certificados automáticos.

---

## 5. Personas e Níveis de Acesso

| Perfil | Necessidade principal | Acesso inicial |
|---|---|---|
| Pastor/Liderança | Visão geral da membresia, células, escalas e relatórios | Web |
| Tesoureiro | Validar comprovantes, lançar contribuições e consultar extratos | Web + App |
| Secretaria | Cadastrar membros, famílias, células e eventos | Web |
| Líder de célula | Registrar reuniões, frequência e visitantes | App |
| Coordenador de ministério | Criar escalas e acompanhar confirmações | Web + App |
| Membro | Consultar extrato, enviar comprovante e ver escala | App |
| Visitante | Cadastro inicial e vínculo futuro | App/Web futuro |

---

## 6. Regras de Permissão

### Membro

- Visualiza apenas seus próprios dados básicos.
- Visualiza seu próprio extrato.
- Envia comprovantes.
- Visualiza suas próprias escalas.
- Confirma ou recusa participação.

### Líder de célula

- Visualiza membros da sua célula.
- Registra presença da reunião.
- Registra visitantes.
- Não visualiza dados financeiros dos membros.

### Tesoureiro

- Visualiza contribuições.
- Valida ou recusa comprovantes.
- Edita lançamentos financeiros.
- Exporta relatórios financeiros.
- Não acessa histórico pastoral sigiloso.

### Secretaria

- Cadastra e edita membros, famílias e células.
- Não acessa valores individuais de contribuição, salvo se autorizado.

### Pastor/Admin

- Acesso administrativo amplo.
- Deve ter trilha de auditoria para ações sensíveis.

---

## 7. Módulos do Produto

## 7.1 Membresia

### Funcionalidades

- Cadastro completo de membro.
- Cadastro de família.
- Situação do membro.
- Vínculo com célula.
- Vínculo com ministérios.
- Histórico básico de entrada, batismo e transferência.
- Busca e filtros.
- Exportação CSV no painel administrativo.

### Campos sugeridos

- Nome completo.
- Nome social/apelido, se aplicável.
- CPF, opcional no MVP.
- Data de nascimento.
- Telefone.
- E-mail.
- Endereço.
- Estado civil.
- Cônjuge.
- Filhos/responsáveis.
- Célula.
- Ministérios.
- Status.

---

## 7.2 Financeiro

### Funcionalidades do MVP

- Membro envia comprovante.
- Membro informa valor, data, categoria e observação.
- Arquivo fica anexado ao lançamento.
- Tesoureiro valida, recusa ou solicita correção.
- Membro visualiza histórico pessoal.
- Tesouraria visualiza pendências.

### Categorias iniciais

- Dízimo.
- Oferta.
- Campanha.
- Missões.
- Evento.
- Outros.

### Status do lançamento

- `pending`: aguardando validação.
- `approved`: validado pelo tesoureiro.
- `rejected`: recusado.
- `needs_review`: divergência ou dúvida.

### Evolução futura

- OCR para extrair valor, data, nome do pagador e ID da transação.
- Pix dinâmico com webhook.
- Integração com API de pagamentos.
- Conciliação bancária.
- Recibo anual.

---

## 7.3 Células

### Funcionalidades

- Cadastro de célula.
- Líder e auxiliar.
- Endereço, dia e horário.
- Lista de membros.
- Relatório de reunião.
- Registro de presença.
- Registro de visitantes.

### Evolução futura

- Alertas de ausência.
- Dashboard de crescimento.
- Plano de discipulado.
- Integração com Escola Bíblica.

---

## 7.4 Escalas de Ministérios

### Ministérios iniciais

- Louvor.
- Técnica.
- Recepção.
- Moriah Kids.
- Dança.
- Teatro.
- Intercessão.
- Comunicação.

### Funcionalidades

- Cadastro de ministérios.
- Cadastro de funções por ministério.
- Criação de culto/evento.
- Alocação de membro por função.
- Confirmação de escala.
- Recusa com justificativa.
- Status da escala.

### Exemplos de funções

**Louvor:** vocal, guitarra, baixo, bateria, teclado, violão, ministro.  
**Técnica:** som, projeção, mídia, transmissão, iluminação.  
**Recepção:** porta, estacionamento, acolhimento, visitantes.  
**Moriah Kids:** professor, auxiliar, check-in, berçário.  

---

## 7.5 Eventos

No MVP, eventos entram como base para escalas e cultos.

### Funcionalidades iniciais

- Cadastro de culto/evento.
- Data, horário e local.
- Tipo: culto, célula, ensaio, reunião, conferência, evento especial.
- Vinculação com escalas.

### Evolução futura

- Inscrição.
- Pagamento.
- Check-in.
- QR Code.
- Lista de espera.
- Certificados.

---

## 8. Stack Recomendada

### Recomendação principal

| Camada | Stack |
|---|---|
| Backend | Django + Django REST Framework |
| Banco de dados | PostgreSQL |
| Painel administrativo | Django Admin customizado |
| App mobile | React Native com Expo + TypeScript |
| Web app futuro | Next.js + TypeScript + Tailwind |
| Autenticação mobile | JWT com djangorestframework-simplejwt |
| Storage de arquivos | S3 compatível: AWS S3, Cloudflare R2 ou MinIO em dev |
| Infra inicial | Docker Compose |
| Deploy inicial | VPS/EC2 com Docker ou PaaS compatível |
| Fila futura | Celery + Redis |
| OCR futuro | Google Cloud Vision API + Tesseract fallback |
| Pagamentos futuro | Efí, Pagar.me ou Mercado Pago |
| Push futuro | Expo Notifications |

### Por que Django

Este projeto é fortemente baseado em cadastros, permissões, painel administrativo, relatórios, anexos, auditoria e workflows internos. Django acelera muito isso porque já entrega:

- ORM maduro.
- Admin pronto.
- Migrations.
- Autenticação.
- Permissões.
- Ecossistema estável.
- Boa produtividade para CRUD administrativo.

### Por que Expo

O app precisa chegar rápido em Android e iOS com uma base só. Expo reduz atrito de build, permite prototipagem rápida e tem bom suporte a câmera, arquivos, notificações e autenticação.

### O que evitar no início

- Microserviços.
- Kubernetes.
- Backend separado para cada módulo.
- OCR obrigatório no primeiro release.
- Pagamentos complexos antes de validar o fluxo manual.
- Painel web customizado antes de explorar o Django Admin.

---

## 9. Arquitetura Inicial

```text
moriah-app/
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── members/
│   │   ├── cells/
│   │   ├── ministries/
│   │   ├── events/
│   │   ├── schedules/
│   │   ├── finance/
│   │   └── audit/
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── mobile/
│   ├── app/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   ├── app.json
│   └── package.json
├── docs/
│   └── PRD_Moriah_App.md
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 10. Modelo de Dados Inicial

### Entidades principais

- `Church`
- `User`
- `Member`
- `Family`
- `FamilyRelationship`
- `Cell`
- `CellMeeting`
- `CellAttendance`
- `Ministry`
- `MinistryRole`
- `Event`
- `Schedule`
- `ScheduleAssignment`
- `Contribution`
- `ContributionAttachment`
- `AuditLog`

### Observação importante

Mesmo que o sistema comece apenas para a Igreja Moriah, as tabelas principais devem ter relação com `Church`. Isso deixa o sistema preparado para multi-igreja no futuro sem obrigar uma arquitetura multi-tenant complexa no MVP.

---

## 11. Plano de Desenvolvimento

## Fase 0 — Preparação

**Duração:** 1 semana

### Entregas

- Repositório Git.
- Docker Compose com PostgreSQL e backend.
- Projeto Django criado.
- Projeto Expo criado.
- Padrões de ambiente `.env`.
- README inicial.

---

## Fase 1 — Base do Backend

**Duração:** 1 a 2 semanas

### Entregas

- Models principais.
- Autenticação JWT.
- Perfis e permissões.
- Django Admin configurado.
- API inicial com DRF.
- Seeds de dados para ambiente local.

### Critério de aceite

Um admin consegue criar igreja, usuários, membros, células, ministérios e eventos pelo painel.

---

## Fase 2 — Membresia e Células

**Duração:** 2 semanas

### Entregas

- CRUD de membros.
- CRUD de famílias.
- CRUD de células.
- Vínculo membro-célula.
- Registro simples de reunião de célula.
- Endpoints para app consultar perfil e célula.

### Critério de aceite

Secretaria consegue cadastrar membros e líderes conseguem visualizar sua célula.

---

## Fase 3 — Financeiro Manual com Comprovantes

**Duração:** 2 semanas

### Entregas

- Cadastro de contribuições.
- Upload de comprovante.
- Status de validação.
- Tela/painel de pendências no admin.
- Endpoint para extrato do membro.
- Endpoint para envio de nova contribuição.

### Critério de aceite

Membro envia comprovante pelo app e tesoureiro valida pelo painel.

---

## Fase 4 — App Mobile MVP

**Duração:** 2 semanas

### Entregas

- Login.
- Home simples.
- Perfil.
- Meu extrato.
- Nova contribuição.
- Upload de comprovante.
- Minha célula.

### Critério de aceite

Um membro consegue entrar, ver seus dados, consultar extrato e enviar comprovante.

---

## Fase 5 — Escalas

**Duração:** 2 semanas

### Entregas

- Ministérios e funções.
- Eventos/cultos.
- Escala por função.
- Confirmação/recusa pelo app.
- Painel de acompanhamento no admin.

### Critério de aceite

Coordenador escala voluntários e cada membro confirma ou recusa pelo app.

---

## Fase 6 — Piloto Interno

**Duração:** 2 semanas

### Entregas

- Ajustes de UX.
- Testes com dados reais controlados.
- Correção de bugs.
- Backup.
- Logs.
- Treinamento de secretaria, tesouraria e líderes.

### Critério de aceite

A Moriah consegue rodar um ciclo real com membresia, comprovantes e escalas sem depender exclusivamente do WhatsApp.

---

## 12. Roadmap Pós-MVP

## Fase 2 do Produto

- OCR de comprovante Pix.
- Push notifications.
- QR Pix gerado no app.
- Recibo anual de contribuições.
- Moriah Kids básico.
- Escola Bíblica básica.

## Fase 3 do Produto

- Pix dinâmico com webhook.
- Eventos com inscrição.
- Check-in por QR Code.
- Painéis pastorais.
- Conciliação bancária.
- Pedidos de oração.

## Fase 4 do Produto

- Multi-igreja.
- Planos comerciais.
- Dashboards avançados.
- App público.
- Integração com WhatsApp.

---

## 13. Requisitos de Segurança e LGPD

O sistema tratará dados pessoais, religiosos e financeiros. Portanto, a segurança precisa ser considerada desde o início.

### Requisitos mínimos

- HTTPS obrigatório em produção.
- Senhas criptografadas pelo mecanismo padrão do Django.
- Controle de acesso por perfil.
- Auditoria para alterações financeiras.
- Auditoria para alterações de dados de membros.
- Backup automático.
- Política de retenção de comprovantes.
- Consentimento do membro para armazenamento de dados.
- Restrição forte sobre dados financeiros individuais.
- Logs sem exposição de dados sensíveis.

### Atenção especial

Evitar qualquer recurso que gere constrangimento, exposição ou julgamento público sobre contribuições. Dados financeiros individuais devem ser tratados como informação restrita.

---

## 14. KPIs do MVP

| Indicador | Meta inicial |
|---|---|
| Membros cadastrados | 80% da base ativa |
| Contribuições enviadas pelo app | 50% em até 60 dias |
| Comprovantes validados sem WhatsApp | 70% em até 90 dias |
| Escalas confirmadas pelo app | 60% em até 60 dias |
| Líderes de célula usando relatório | 50% em até 90 dias |
| Redução de retrabalho da tesouraria | Evidência qualitativa em 30 dias |

---

## 15. Decisões de Produto

| Tema | Decisão |
|---|---|
| OCR | Não entra no MVP. Fica para evolução. |
| Pagamento no app | Não entra no MVP. Começa com comprovante Pix. |
| Painel web customizado | Não entra no MVP. Começa com Django Admin. |
| App mobile | Entra no MVP com fluxo simples. |
| Multi-igreja | Preparar modelagem, mas não vender como SaaS ainda. |
| Ranking de dízimos | Evitar. Alto risco pastoral e de privacidade. |
| Relatórios pastorais | Começar simples e sem exposição indevida. |

---

## 16. Prompt para Claude Code

Use o prompt abaixo para iniciar o desenvolvimento do projeto.

```text
Você é um engenheiro full-stack sênior. Quero que você desenvolva o MVP de uma plataforma chamada Moriah App, para gestão interna da Igreja Moriah.

Contexto do produto:
A plataforma precisa centralizar membros, famílias, células, ministérios, eventos, escalas e contribuições financeiras com envio de comprovantes Pix. O objetivo do MVP é reduzir o uso de WhatsApp, planilhas e fichas manuais.

Stack obrigatória:
- Backend: Django + Django REST Framework
- Banco: PostgreSQL
- Admin: Django Admin customizado
- Autenticação mobile: JWT com djangorestframework-simplejwt
- Mobile: React Native com Expo + TypeScript
- Infra local: Docker Compose
- Uploads: armazenamento local em desenvolvimento, com camada preparada para S3 no futuro

Não implementar agora:
- OCR automático
- Pix dinâmico
- Pagamento por cartão
- Conciliação bancária
- Chat interno
- Push notifications avançadas
- Next.js

Estrutura desejada do repositório:

moriah-app/
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── members/
│   │   ├── cells/
│   │   ├── ministries/
│   │   ├── events/
│   │   ├── schedules/
│   │   ├── finance/
│   │   └── audit/
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── mobile/
│   ├── app/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   ├── app.json
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md

Entregue primeiro um esqueleto funcional com:

1. Backend Django
- Projeto Django configurado.
- Apps separados por domínio.
- PostgreSQL via Docker Compose.
- Variáveis de ambiente via .env.
- Django REST Framework configurado.
- SimpleJWT configurado.
- CORS configurado para o app mobile.
- Admin habilitado.

2. Models iniciais
Crie os models abaixo com campos essenciais, timestamps e relacionamento com Church quando fizer sentido:

- Church
- User customizado ou Profile vinculado ao User do Django
- Member
- Family
- FamilyRelationship
- Cell
- CellMeeting
- CellAttendance
- Ministry
- MinistryRole
- Event
- Schedule
- ScheduleAssignment
- Contribution
- ContributionAttachment
- AuditLog

3. Regras básicas
- Um membro pode pertencer a uma célula.
- Um membro pode servir em vários ministérios.
- Um evento pode ter uma ou mais escalas.
- Uma escala possui assignments por função.
- Um assignment pode ter status: pending, confirmed, declined.
- Uma contribuição pode ter status: pending, approved, rejected, needs_review.
- Uma contribuição pode ter um ou mais anexos.
- O membro só pode visualizar o próprio extrato.
- Tesoureiro e admin podem validar contribuições.

4. APIs REST
Crie endpoints para:
- Login JWT.
- Perfil do usuário logado.
- Listar dados do membro logado.
- Listar extrato do membro logado.
- Criar contribuição com upload de comprovante.
- Listar escalas do membro logado.
- Confirmar escala.
- Recusar escala com justificativa.
- Líder de célula listar membros da sua célula.
- Líder de célula registrar reunião e presença.

5. Django Admin
Configure o Django Admin para permitir gestão de:
- Igrejas
- Usuários
- Membros
- Famílias
- Células
- Ministérios
- Funções
- Eventos
- Escalas
- Contribuições
- Anexos

No admin de contribuições, destaque status pendente e permita filtro por status, período, membro e categoria.

6. App Mobile Expo
Crie um app mobile simples com:
- Tela de login.
- Tela inicial.
- Tela Meu Perfil.
- Tela Meu Extrato.
- Tela Nova Contribuição.
- Upload de comprovante por imagem ou documento.
- Tela Minha Escala.
- Ação de confirmar escala.
- Ação de recusar escala com justificativa.

7. Qualidade
- Código organizado.
- Tipagem no mobile.
- Serializers claros no backend.
- Permissões explícitas no DRF.
- README com instruções para rodar tudo localmente.
- .env.example completo.
- Dados seed simples para teste local.

8. Primeiro objetivo técnico
A primeira entrega deve permitir o seguinte fluxo funcionando localmente:

- Admin cria um membro no Django Admin.
- Admin cria uma célula e vincula o membro.
- Admin cria um evento/culto.
- Admin cria uma escala e escala o membro em uma função.
- Membro faz login no app.
- Membro vê sua escala.
- Membro confirma ou recusa.
- Membro envia uma contribuição com comprovante.
- Tesoureiro vê a contribuição pendente no admin.
- Tesoureiro aprova a contribuição.
- Membro visualiza a contribuição aprovada no extrato.

Comece criando a estrutura do projeto, arquivos de configuração e models. Depois implemente APIs e telas mobile. Priorize funcionamento real do fluxo acima antes de qualquer refinamento visual.
```

---

## 17. Veredito

O projeto é viável e tem valor real para a Igreja Moriah. O caminho correto é começar pequeno, com foco em três frentes:

1. **Membresia organizada.**
2. **Comprovantes financeiros fora do WhatsApp.**
3. **Escalas confirmadas pelo app.**

Depois disso, a plataforma pode evoluir para OCR, Pix integrado, Moriah Kids, Escola Bíblica, eventos e dashboards.

A stack recomendada para começar é:

> **Django + Django REST Framework + PostgreSQL + Expo React Native + Django Admin.**
