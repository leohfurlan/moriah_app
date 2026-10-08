# Refinamento de UX/UI do Moriah

## Decisões e cobertura

O ícone/nome da conta abre um painel contextual com identificação, “Meu Perfil”
e “Sair”. Logout saiu do cabeçalho secundário e do rodapé da Home. O menu aparece
também no celular, fecha com clique fora/Escape e devolve o foco ao acionador.
A ação de sair continua limpando tokens e perfil pela rotina existente.

| Área revisada | Ajuste aplicado |
|---|---|
| Navegação desktop | Sidebar desliza em 240 ms; escolha de recolhimento acompanha as rotas; links invisíveis saem do teclado |
| Navegação e conta mobile | Acionador de conta consistente, sem avatar duplicado e sem botão Sair solto |
| Home, Perfil e páginas de gestão | Entrada curta do conteúdo com fade e deslocamento de 8 px, em 180 ms |
| Links, botões e ações de listas | Hover gradual em 160 ms, sem resposta em controles desabilitados |
| Sidebar | Destaque específico ao mouse, preservando a indicação da rota selecionada; alvos ampliados |
| Cartões clicáveis | Borda e sombra discretas ao mouse; cartões informativos permanecem estáveis |
| Formulários e login/WhatsApp | Foco de teclado visível nos campos e controles |
| Busca e notificações | Entrada suave dos painéis compartilhados |
| Mensagens e feedback | Alertas inline e toast entram suavemente; mensagens e prazos existentes preservados |
| Agenda e datas | Seletores respeitam movimento reduzido |
| Escalas e equipe | Filtros e painéis de edição respeitam movimento reduzido |
| Home/atalhos | Janela de atalhos preserva slide, desativado com movimento reduzido |
| Desktop intermediário | Busca e conta adaptam a largura, evitando disputar espaço com o título |

A revisão considerou os componentes compartilhados e os fluxos de Home, Perfil,
cadastro/login, diretório de membros/visitantes, conteúdo, eventos, agenda,
contribuições/extrato, revisão/gestão financeira, escalas e notificações.
Telas de módulos ainda indisponíveis permanecem fora da navegação.

Não há animação contínua, delays em ações de negócio, efeitos por item nas listas
ou movimento em cartões informativos. O objetivo é dar continuidade à navegação
e deixar claro quais elementos respondem à interação.

## Acessibilidade e validação

`prefers-reduced-motion` desativa as transições CSS; a preferência de acessibilidade
também controla MotionView, janelas e navegação nativa. Foco visível, área de toque
do menu e ações de teclado são tratados nos componentes comuns. A validação
visual usa navegador desktop e mobile emulado; não substitui teste físico Android/iOS.

Verificador específico: `node tools/qa/scripts/ux-motion.mjs`, com QA_BASE apontando
ao ambiente isolado. Abrange menu, clique fora, Escape/foco, Perfil, logout,
hover, largura intermediária durante o slide, exclusão do sidebar do teclado,
movimento reduzido e ausência de overflow horizontal em 390/1024/1440 px.
As fases de QA existentes verificam os fluxos funcionais após os ajustes comuns.

Evidências visuais regeneráveis em `tmp/ux-account-desktop.png`,
`tmp/ux-account-mobile.png` e `tmp/ux-account-reduced.png`.

Resultado local: TypeScript aprovado, 12 testes mobile aprovados e 92 verificações
funcionais nas seis fases de QA sem falhas. Os três cenários específicos de UX
(desktop, celular e movimento reduzido) passaram. Bundle de produção exportado
e servido pelo mesmo Nginx usado no deploy.

## Publicação

Frontend publicado em https://app.igrejamoriah.com na revisão 00d61c2bff3a.
Menu, navegação ao Perfil, logout, hover, slide, teclado e movimento reduzido
passaram nos três cenários também no domínio público. HTTPS e health aprovados.
Backend permanece em 2fdea81064bb e banco preservado; serviços Nexor responderam 200.
Publicação realizada somente no container web, com rollback automático preparado.
