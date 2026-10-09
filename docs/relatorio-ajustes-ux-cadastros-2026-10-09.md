# Ajustes de UX e cadastros administrativos — 09/10/2026

Decisão complementar à F11: os links de configuração devem abrir páginas do próprio app. O Django Admin fica reservado à conta `admin@igrejamoriah.com`, mantendo a exigência de conta ativa, staff e perfil concluído.

## Entrega

- Transição entre apresentação, perfil e conclusão: saída e entrada simultâneas com opacidade e deslocamento suave (280 ms), respeitando movimento reduzido. A camada de saída não recebe toques nem é exposta ao leitor de tela.
- Rótulos visíveis acima de nome, e-mail e nascimento. E-mail permanece somente leitura. Textos explicativos justificados.
- Data digitável com máscara automática DD/MM/AAAA, aceitando colagem com barras. Calendário com mês, ano editável, dias válidos e bloqueio de nascimento futuro. O mesmo componente atende às datas dos eventos.
- Páginas `/settings/church`, `/settings/team`, `/settings/events`, `/settings/cells` e `/settings/ministries`, acessíveis pelos seis itens permanentes do checklist. Os horários continuam em `/service-times`, agora com rótulos visíveis.
- Dados da igreja: nome, razão social, CNPJ, cidade e UF.
- Equipe: criação com senha inicial validada, papel principal, papéis adicionais e ativação/desativação. E-mail e senha de contas existentes não são alterados por essa API. Conta responsável, superusuários e a própria conta são protegidos contra alterações pela tela de equipe.
- Eventos: tipo, início, término opcional, local, descrição e publicação/rascunho. Datas são convertidas a partir do horário local.
- Células: nome, líder, auxiliar, dia, horário, local e observações.
- Ministérios: nome, descrição, coordenadores e participantes.
- APIs restritas à administração, com igreja inferida da sessão autenticada; relações também limitadas à igreja. Campos técnicos de privilégios e troca de igreja são rejeitados. Gravações auditadas sem senhas.
- Django Admin: política central no AdminSite e no formulário de login; middleware também recusa sessões antigas de outras contas, mesmo superusuárias e mesmo com onboarding desabilitado.

## Validação

- PostgreSQL: 321 testes passaram, incluindo concorrência.
- SQLite: 314 testes passaram; 7 testes de locks exclusivos de PostgreSQL ignorados.
- 19 testes novos de cadastros, permissões, isolamento, auditoria, validação e controle positivo do proprietário.
- 13 regressões mobile, TypeScript, export web e `git diff --check`.
- Django check sem problemas; nenhuma migração adicional.
- Navegador real em desktop 1440×1000 e celular 390×844: transições com quadros intermediários, movimento reduzido, rótulos, números/colagem, calendário bissexto, alinhamento, criação e edição dos cinco cadastros e persistência após recarga. Dados sintéticos e banco descartável, sem chamadas WhatsApp reais.
- OpenAPI: sem conflito de nomes nos serializers novos; continuam os 76 apontamentos de erro de introspecção das sete views preexistentes de WhatsApp/mídia privada. Não representam resultado limpo de schema.
- Calendário e animação implementados em React Native; a verificação visual foi feita no navegador, sem dispositivo Android/iOS instalado.

Evidências visuais em `output/playwright/f11/ux-*`. Roteiro reproduzível: `tools/qa/scripts/f11-ux.mjs`, exclusivo do ambiente local descartável.
