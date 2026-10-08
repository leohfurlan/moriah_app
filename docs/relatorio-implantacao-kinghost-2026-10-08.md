# Release KingHost — Moriah, 08/10/2026

## Escopo final aprovado

Destino `atos-pd`, domínio `app.igrejamoriah.com`. PostgreSQL exclusivo e
arquivos na própria VPS, por decisão do usuário durante a execução. Runtime
Gunicorn + gateway web estático; proxy HTTPS existente. Admin e interfaces
implementadas do MVP; WhatsApp, Projetos Sociais e módulos ocultos permanecem
fora da release. Desenvolvimento e deploy foram autorizados.

## Implementação

- Configuração KingHost com limites de CPU/memória, PostgreSQL 16 e volumes
  persistentes; credencial de app sem superuser, separada do administrador.
- Bundle Expo exportado com `/backend`, gateway Nginx e preservação do Host.
- Healthchecks sem SQL periódico; migrations e permissões explícitas.
- Arquivos locais protegidos por assinatura de 15 minutos, igreja e autorização
  atual; download anônimo direto bloqueado; integração com links do admin.
- Logs sem query string para não registrar tokens de download.
- Script de deploy com revisão validada nas duas imagens e checks de segurança.
- Backup de banco e arquivos, checksums, retenção e timer diário.
- Fixtures de agenda com datas relativas; correções existentes de guardas,
  capacidades e ocultação de módulos preservadas e incluídas na release.
- QA ajustado para o preenchimento real do login, loading com reticência
  correta e recuperação de publicação; tesouraria testada pelo botão real.
- CI passa a exportar o bundle web de produção.

## Validação

| Gate | Resultado |
|---|---|
| Backend Linux/Python 3.12 + PostgreSQL isolado, código final | 226 passaram |
| Backend SQLite antes do teste adicional do widget admin | 225 passaram; 7 testes de arquivos privados passaram após o teste adicional |
| Migrações | Aplicadas em banco descartável; nenhuma alteração de schema pendente |
| TypeScript e regressões mobile | Sem erros; 12/12 |
| Export web | Sucesso, bundle de 3,1 MB |
| Imagens backend e web | Construídas e inicializadas no ensaio persistente |
| Segurança de produção | `check --deploy --tag security --fail-level WARNING`: sem issues com volume real |
| Upload privado real | Upload 201; link assinado 200; sem token 404; `/media` direto 404 |
| Recuperação | Dump restaurado em container descartável; 5 tabelas críticas conferidas; media restaurada e conteúdo conferido |
| QA navegador desktop/mobile | Fase1 20; fase2 14; fase3 14; fase4 11; fase5 13; fase6 20 — 92 verificações, 0 falhas |
| QA visual | Screenshots de conteúdo desktop e mobile inspecionados |

Evidências locais regeneráveis: `tmp/kinghost-qa-final.log`,
`docs/qa/evidencias/fase1-2026-10-08T122021`,
`fase2-2026-10-08T122121`, `fase3-2026-10-08T122232`,
`fase4-2026-10-08T122235`, `fase6-2026-10-08T122405`,
`output/playwright/fase5-2026-10-08T122401`. Fase 6 usa API simulada;
regras reais de conteúdo foram verificadas pela suíte backend.

## Operação e limites

O gerenciamento Docker usa a conta administrativa já existente. A criação
de novo usuário com grupo Docker foi rejeitada pela revisão automática por
conceder privilégio equivalente a root; a alternativa executada não alterou
usuários ou grupos. Aplicação e gateway rodam sem root nos containers.

Backups ficam na VPS, conforme a decisão atual; não há cópia externa para
recuperação de perda do host/disco. O registro DNS `app` foi confirmado e
o HTTPS está ativo no subdomínio aprovado.

## Execução remota

Release `635e0fab0912` publicada em https://app.igrejamoriah.com em 08/10/2026,
na VPS `atos-pd` (191.252.159.77). Arquivos de release verificados por SHA-256.
Backend, web e PostgreSQL estão saudáveis. As migrações foram aplicadas no
banco exclusivo, com usuário de aplicação sem privilégio de superusuário.
O banco não tem porta pública; backend vinculado somente a localhost.
Backend e gateway executam sem root. Arquivos privados usam volume persistente.

Certificado TLS validado, válido até 06/01/2027, com renovação automática pelo
Caddy. Readiness confirmou banco e revisão. Rotas SPA, arquivos estáticos do
admin, bloqueio de arquivos sem assinatura e login administrativo real passaram.
Login e página inicial também verificados e inspecionados visualmente em desktop
e celular. Criada apenas a igreja e sua conta administrativa inicial; sem seed demo.
Credenciais guardadas em arquivo local ignorado pelo Git, fora deste relatório.

Backup inicial concluído às 15:54:25 UTC. Dump restaurado em PostgreSQL
descartável: contagens de cinco tabelas críticas conferidas, arquivos restaurados
em volume descartável. Recursos do ensaio removidos; banco original preservado.
Serviço `moriah-kinghost.service` ativo e habilitado no boot; timer de backup
ativo diariamente às 02h America/Sao_Paulo, com retenção de 30 dias.

O Caddy recebeu apenas a nova rota e conexão à rede `moriah_piloto_edge`, com
backup prévio da configuração e reload validado. Nexor web, API health e site
responderam 200 após a publicação. Proxy, Simulador e Evolution mantiveram seus
containers e tempos de execução, sem reinício provocado pela implantação.

Diretório `/opt/moriah_app`; backups restritos em `/var/backups/moriah`.
Evidências visuais locais: `tmp/moriah-live-desktop.png` e
`tmp/moriah-live-mobile.png`. A release foi commitada; nenhum push foi realizado.

Referência operacional: [runbook KingHost](runbook-kinghost.md).
