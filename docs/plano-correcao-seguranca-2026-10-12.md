# Plano de implementação das correções de segurança

Data: 12/10/2026. Status: planejado; implementação não iniciada.

Fonte: [auditoria de segurança](auditoria-seguranca-2026-10-12.md). Base observada: `f95d579`, branch atual `codex/notification-bell-and-back`; esse estado deve ser revalidado ao iniciar.

## Objetivo e entrega

Corrigir SEC-01 a SEC-10, reduzir exposição de segredos e deixar evidências repetíveis de isolamento, autenticação, revogação e proteção da infraestrutura. O resultado esperado é código, migrations, configurações, runbooks, testes e relatório final vinculados à mesma revisão.

**Branch proposta:** `codex/security-hardening`. Criá-la no início da execução, em worktree dedicado, a partir da branch principal atualizada. O nome é uma proposta deste plano; nenhuma branch foi criada nesta etapa.

O pedido atual entrega este plano. Implementação, publicação de PR e aplicação em produção são etapas posteriores; respeitar as autorizações já existentes e o escopo solicitado ao executar. Não alterar produção durante o desenvolvimento local.

## Regras de execução

- Preservar alterações existentes. A auditoria está atualmente não rastreada; levar auditoria e plano explicitamente para a nova worktree, sem staging de outros arquivos.
- Revalidar branch principal, divergências desde `f95d579`, instruções do repositório e revisão implantada antes da primeira mudança.
- Worktree não isola dados: usar projeto Compose, banco, mídia, portas e contas descartáveis próprios. Nunca usar o `.env.pilot` real nos testes.
- Não imprimir segredos, tokens, OTPs, cookies, telefones completos ou corpos de erros externos em logs/evidências.
- Manter PostgreSQL e mídia na KingHost. Backup externo é evolução adicional; não substituir a arquitetura atual por Neon/S3.
- Não ativar outro proxy, não aplicar cloud-init Oracle e não reiniciar os sistemas compartilhados para corrigir o Moriah.
- Separar commits por etapa. Nenhum achado fica encerrado apenas porque `check --deploy` passou.

## Sequência e dependências

| Etapa | Entrega | Achados | Dependência |
|---|---|---|---|
| S00 | Worktree, baseline, regressões e inventário | Todos | Nenhuma |
| S01 | Isolamento financeiro | SEC-02 | S00 |
| S02 | Segredos por serviço e inicialização segura | SEC-03 + endurecimento | S00 |
| S03 | Atualização das dependências | SEC-04 | S01/S02 validadas |
| S04 | Limites de login e política de igreja ativa | SEC-05, SEC-10 | S03 |
| S05 | Sessões revogáveis e clientes web/nativo | SEC-06, SEC-08 | S04 |
| S06 | MFA administrativo | Complemento de SEC-05 | S05 |
| S07 | Cabeçalhos, dotfiles e proteção do frontend | SEC-09 | S05; compatível com S06 |
| S08 | Configuração e aplicação controlada na VPS | SEC-01, SEC-07 | Inventário S00 e acesso de recuperação; aplicação em janela própria |
| S09 | Backup externo e minimização de dados | Complementos da auditoria | Destino e matriz de campos definidos |
| S10 | Aceite integrado, PR e implantação por lotes | Todos | Gates das etapas correspondentes |

A preparação de S08 começa em S00. Seu fechamento em produção não precisa esperar toda a mudança de sessões: a exposição administrativa pode ser corrigida numa janela independente após validar acesso, regras e rollback.

## S00 — Preparação e evidências

1. Identificar a branch principal real e criar a worktree da branch proposta sem transportar arquivos de ambiente.
2. Copiar auditoria/plano e registrar SHA inicial, comandos, versões e recursos isolados.
3. Reexecutar baseline com Python 3.12, SQLite e PostgreSQL 16 descartável. Os resultados anteriores (318 aprovados/7 pulados) são referência histórica, não aceite da nova branch.
4. Transformar os quatro testes de reprodução em testes permanentes que esperam o comportamento seguro; adicionar controles positivos e casos POST/PATCH, aliases e concorrência.
5. Preparar inventário somente leitura da VPS: serviços, portas IPv4/IPv6, redes Docker, regras de firewall, proxy, usuários SSH e acesso ao console do provedor. Não copiar configurações completas que possam conter segredos para o repositório.

**Aceite:** recursos de teste comprovadamente isolados; regressões relevantes falham antes das correções; artefatos originais preservados; nenhuma escrita de teste na aplicação real.

## S01 — Impedir referências financeiras entre igrejas

**Arquivos centrais:** `backend/apps/finance/serializers.py`, `views.py`, serviço/modelo financeiro e `tests/test_financial_entries.py`.

- Restringir os campos relacionais `member` e `event` à igreja autenticada durante a resolução do serializer.
- Validar coerência também no ponto de escrita compartilhado. `Model.clean()` isolado não basta: `save()` não executa `full_clean()` automaticamente. Identificar e proteger API, admin e serviços que escrevem lançamentos; não prometer proteção para SQL arbitrário/bulk updates sem mecanismo adicional.
- Cobrir criação e edição parcial, inclusive valor preservado da instância. Campos opcionais continuam aceitando `null` quando permitido.
- Retornar erro de referência inválida sem nome/dado do objeto estrangeiro; evitar distinguir ID estrangeiro de ID inexistente.
- Criar verificador somente leitura de inconsistências existentes, sem reparar dados automaticamente.

**Aceite:** POST/PATCH estrangeiros são recusados e não alteram dados; objetos da própria igreja funcionam; membro sem papel financeiro continua sem acesso; nenhum nome estrangeiro aparece em erro/resposta; verificador documentado.

## S02 — Reduzir segredos e falhar com configuração insegura

**Arquivos centrais:** `docker-compose.pilot.yml`, `docker-compose.kinghost.yml`, variantes CI/dev, `deploy/kinghost.env.example`, `backend/config/{settings,env,checks}.py`, Dockerfiles e scripts de deploy/backup.

- Substituir a injeção integral do `.env.pilot` por mapeamento explícito de variáveis por serviço. O arquivo pode continuar sendo fonte de interpolação do Compose, com permissão 600.
- Backend/migrate recebem apenas credencial da aplicação e configurações necessárias. `POSTGRES_ADMIN_PASSWORD` é exclusivo do serviço de banco e operações administrativas que o exigirem; web não recebe segredos.
- Conferir privilégios: usuário da aplicação sem superuser, CREATEDB ou CREATEROLE; migrations com permissões necessárias somente no banco/esquema Moriah. Separar conta de migração apenas se necessário e documentar seu uso.
- Preservar volume PostgreSQL existente: mudar variável de inicialização do container não troca a senha de uma instância já inicializada. Rotação de senha é operação SQL própria, coordenada com consumidores, e não será simulada por edição de env.
- Falhar na inicialização de produção com chave Django ausente/de exemplo ou configuração crítica inválida. Preservar execução de `collectstatic` usando configuração descartável própria do build, sem segredo real persistido na imagem; testes também usam valores descartáveis explícitos.
- Revisar ignorados/contextos de build e validar imagem final, ambiente efetivo e logs sem expor valores. Testar com segredos sentinela artificiais.

**Aceite:** senha administrativa ausente do ambiente/imagem do backend e migrate; build, migrations e backup continuam funcionais; web sem credenciais; startup de produção recusa chave insegura; configuração válida sobe; nenhum segredo sentinela no bundle/log/imagem indevida.

## S03 — Dependências suportadas e revisão de advisories

- Migrar Django para a série 5.2 LTS, fixando o patch vigente no momento da execução e verificando compatibilidade com Python 3.12, PostgreSQL, DRF, SimpleJWT, storage e schema.
- Atualizar dependências diretas/transitivas afetadas por avisos relevantes, preservando mudanças pequenas e explicáveis. Não executar correção automática com atualização maior indiscriminada.
- Revisar dependências Expo/React Native e imagens base; distinguir vulnerabilidade em ferramenta de build de vulnerabilidade alcançável em runtime. Registrar versão, advisory, alcance, correção e justificativas para exceções temporárias com prazo.
- Atualizar locks e reexecutar testes, schema, builds e instalação limpa. Usar as mesmas versões de runtime no CI e nas imagens de produção.
- Integrar detecção de segredos e revisão de dependências no CI. Consultas que enviem nomes/versões a serviços externos dependem da autorização correspondente; não contornar a rejeição anterior do `npm audit`. A revisão por fontes oficiais pode continuar sem envio do inventário.

**Aceite:** Django em série suportada; ausência de achado alto/crítico conhecido e alcançável sem tratamento registrado; lock coerente; suite/builds verdes. Scanner indisponível deve constar como pendência, não resultado limpo.

## S04 — Login com limites e igreja ativa

**Arquivos centrais:** autenticação em `backend/apps/accounts/`, `config/urls.py`, configuração de IP/proxy e testes.

- Criar ponto único de autenticação por senha utilizado em `/api/`, `/backend/` e `/local-api/`; preservar limites existentes do WhatsApp.
- Implementar contadores compartilhados entre workers em PostgreSQL, com transação/lock e chave derivada por HMAC de identificador/IP, reaproveitando o padrão existente do OTP. Não depender de memória de processo.
- Parâmetros iniciais propostos: 5 falhas por par conta/IP em 15 minutos; 50 tentativas por IP em 15 minutos; penalidade temporária e limites agregados calibráveis. Medir impacto em redes compartilhadas e ataques distribuídos; evitar bloqueio permanente de conta por ação de terceiros.
- Usar IP derivado apenas da cadeia de proxy confiável, com tratamento IPv4/IPv6. Rejeitar spoof de headers e não confiar diretamente em `X-Forwarded-For` recebido do cliente.
- Respostas sem enumerar usuários; 429 com `Retry-After`; testes controlam relógio, não usam esperas longas.
- Definir `Church.active=False` como suspensão de acesso à igreja, preservando registros. Aplicar a login por senha, WhatsApp, refresh, requisições autenticadas, admin e mídia privada; saúde pública permanece acessível. A integração Talk2me já verifica igreja ativa e deve continuar verificando.
- Registrar falhas/bloqueios de forma minimizada, sem senha/token/OTP. Preparar política de retenção e limpeza dos contadores.

**Aceite:** alternar alias/worker não reinicia limite; tentativa concorrente não excede teto; header falso não muda IP confiável; recuperação após janela funciona; login válido e NAT compartilhado têm controles positivos; igreja suspensa não emite/renova sessão e sessões existentes perdem acesso.

## S05 — Revogação real e armazenamento por plataforma

**Arquivos centrais:** autenticação/session service e migrations em accounts; `config/settings.py`, `private_media.py`, middleware de onboarding; `mobile/src/services/{api,storage}.ts`, `hooks/useAuth.ts`, telas de autenticação e testes.

### Contrato proposto

- Manter JWT assinado com SimpleJWT, com access inicial de 10 minutos e refresh de 7 dias. Criar registro de sessão revogável (`sid`, usuário, igreja, expiração absoluta, revogação e dados mínimos), validado pela autenticação central.
- Access/refresh carregam `sid`. Revogar a sessão invalida ambos nas próximas requisições. Não usar somente blacklist de refresh se o aceite exigir revogação imediata do access.
- Rotacionar refresh e invalidar o anterior, com proteção transacional contra reutilização concorrente. Limitar a vida absoluta da sessão a 7 dias mesmo que a biblioteca renove `exp` a cada rotação.
- Logout revoga a sessão atual, é idempotente e limpa armazenamento/cookie; logout geral e troca de senha revogam todas as sessões. Desativação de usuário/igreja também impede acesso. Atualização de papéis deve ser considerada em cada requisição, sem autorização persistida no cliente.
- Login por senha e WhatsApp usam o mesmo emissor de sessão; não deixar fluxo alternativo emitindo tokens sem `sid` ou sem políticas novas.
- Web: access em memória; refresh em cookie Secure/HttpOnly, SameSite adequado à implantação de mesma origem e sem Domain amplo. Nenhum refresh em JSON para o fluxo web. Login, refresh, logout e demais operações baseadas em cookie têm validação CSRF explícita, inclusive nas views DRF; não presumir que o middleware protege APIViews isentas.
- Android/iOS: refresh em Expo SecureStore compatível com o SDK; access preferencialmente em memória. Renovação retorna o par e o cliente salva também o novo refresh. Remover tokens antigos de AsyncStorage.
- Distinguir contratos web/nativo explicitamente; não decidir segurança pela string User-Agent. Headers enviados pelo cliente não concedem privilégios nem dispensam validação de cookie/CSRF no fluxo web.
- Preservar o single-flight dentro do cliente e tratar múltiplas abas sem persistir tokens em localStorage. Definir serialização de refresh entre abas ou tratamento de conflito que não deslogue silenciosamente sessões legítimas.
- Nos downloads privados locais, vincular assinatura à sessão para aplicar revogação também aos links já emitidos; preservar caso de arquivo gerado pelo Django Admin com sessão administrativa. Política para S3 é distinta: URLs assinadas já emitidas continuam válidas até expirar, salvo outro mecanismo.
- Logout sem rede limpa o dispositivo, mas não garante revogação no servidor. Informar esse limite no contrato e testar falhas; não afirmar revogação remota se o servidor não confirmou.

### Transição e aceite

Migrations aditivas primeiro. O corte para a nova autenticação exige novo login: JWTs legados sem sessão são recusados após ativação. Não manter fallback silencioso que preserve tokens roubados. Backend e bundle devem ser publicados como lote compatível; builds nativos antigos precisam de estratégia explícita de atualização antes do corte.

**Aceite:** access/refresh copiados deixam de funcionar após logout confirmado/troca de senha; refresh anterior não funciona depois de rotação; concorrência testada em PostgreSQL; reload web recupera sessão por cookie sem tokens em armazenamento JS; CSRF ausente/errado e origem indevida são recusados; duas abas, retomada mobile, falha de rede, onboarding e mídia privada funcionam conforme contrato; cookies e tokens não entram em logs.

## S06 — MFA para administração

- Adotar TOTP por biblioteca mantida/compatível com Django, com códigos de recuperação de uso único armazenados como hash. Segredo TOTP criptografado com chave própria de produção e estratégia documentada de recuperação/rotação.
- Exigir MFA para o proprietário do Django Admin e contas com capacidades de gestão sensíveis. Definir matriz por capacidade, incluindo papéis adicionais, e usar a mesma regra no backend; a interface só comunica a política.
- Senha ou OTP WhatsApp para conta sujeita a MFA produz desafio temporário restrito; sessão completa somente após segundo fator. Não aceitar WhatsApp sozinho como bypass de MFA administrativo.
- Cobrir cadastro inicial, confirmação do dispositivo, perda do autenticador, alteração de papel e reset administrativo auditado. Não depender de cadastro de membro para acesso operacional.
- Aplicar a regra também ao Django Admin e sessões antigas. Recuperação não pode conceder privilégios somente por telefone/e-mail cadastrado ou criar conta secreta de emergência.

**Aceite:** conta privilegiada não acessa API/admin antes do segundo fator; desafio expira, limita tentativas e não é reutilizável; código de recuperação só funciona uma vez; elevação de papel exige novo nível de autenticação; contas comuns mantêm o fluxo previsto; acesso de recuperação ensaiado antes da ativação obrigatória.

## S07 — Cabeçalhos e proteção do frontend

**Arquivos centrais:** `deploy/nginx-web.conf`, configuração do vhost Caddy Moriah, build web e testes HTTP/browser.

- Aplicar nos documentos estáticos e erros relevantes `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, Referrer-Policy e Permissions-Policy compatível com upload/câmera do app.
- HSTS no domínio HTTPS, preservando semântica do proxy. Avaliar alcance de includeSubDomains/preload em vez de expandir cegamente a política do domínio.
- Construir CSP a partir do export Expo e recursos usados: começar em Report-Only em ambiente de validação, corrigir violações e ativar enforcement. Evitar permissões amplas para scripts; não usar `unsafe-eval` como solução automática.
- Responder 404 para dotfiles, `.env*`, `.git` e artefatos privados, preservando exceções necessárias como `/.well-known/` e rotas legítimas da SPA.
- Manter `/media/` fechado, cache imutável apenas em assets versionados e nenhuma resposta privada cacheada publicamente.

**Aceite:** cabeçalhos presentes no HTML, API e respostas aplicáveis; dotfiles retornam 404 real; navegação direta/reload, login, CSRF/cookies, câmera/upload, fontes/imagens e carrossel funcionam em desktop/mobile; CSP não exige afrouxamento genérico.

## S08 — SSH, firewall e Monit na VPS compartilhada

**Entrega na branch:** runbook específico da KingHost, templates de configuração e verificadores somente leitura. Aplicar em janela própria com evidência do diff final; não reutilizar automaticamente o provisionamento Oracle.

1. Confirmar console de recuperação do provedor, usuário administrativo com chave, privilégios sudo e duas sessões independentes funcionando.
2. Mapear acessos legítimos ao Monit. Preferir bind localhost e túnel SSH/VPN; testar acesso administrativo permitido antes de fechar a porta pública 2812, em IPv4/IPv6.
3. Escolher restrição de SSH por VPN ou IP administrativo com base no acesso real; não inventar CIDR nem abrir porta de sudo/administrador adicional sem necessidade.
4. Preparar firewall para portas/serviços inventariados, contemplando publicações Docker, tráfego entre redes, conexões estabelecidas e IPv6. UFW isolado não é garantia de bloquear portas publicadas pelo Docker.
5. Validar sintaxe do sshd e regras em ambiente apropriado; aplicar primeiro as permissões do novo acesso. Programar reversão automática com prazo suficiente e manter a sessão anterior aberta.
6. Desativar senha e login direto de root; testar nova conexão externa e acesso de recuperação. Confirmar HTTPS/SSH permitidos e backend/banco/Monit bloqueados de fora.
7. Instalar/configurar proteção contra abuso SSH se fizer parte da política escolhida; documentar limites para não bloquear o administrador legítimo.
8. Cancelar a reversão automática só após os controles positivos/negativos e saúde dos serviços compartilhados passarem.

**Aceite:** acesso administrativo por chave funciona; senha/root recusados; Monit privado; portas esperadas continuam acessíveis; Moriah, Nexor, Evolution e Simulador mantêm seus fluxos/saúde; plano de recuperação ensaiado. Não basta observar `ufw active`.

## S09 — Backups e dados pessoais

- Manter backup local e retenção atual. Acrescentar export cifrado para destino externo ao host, com conta restrita, segredo separado e, quando disponível, imutabilidade/credencial sem poder de apagar histórico.
- Definir destino, custo, retenção, responsáveis e custódia da chave antes da ativação. A escolha depende do usuário; o planejamento e o teste com destino descartável podem avançar.
- Detectar ausência de execução/sucesso, falha de envio e atraso do último backup; alertar sem segredos ou dados pessoais. O canal de envio precisa estar autorizado.
- Restaurar banco e mídia em recursos descartáveis; conferir integridade, contagens e acesso aos anexos. Diferenciar validação do arquivo de restauração completa.
- Propor RPO de 24 horas para o backup diário; medir e registrar RTO no ensaio, sem prometer duração antes da medição. Explicitar consistência entre banco e mídia e janela de pausa de escrita quando necessária.
- Produzir matriz campo × papel para membros, com perfis reduzidos para tesouraria/coordenação e acesso justificado a notas, endereço e relações familiares. Não retirar campos consumidos pelo frontend sem atualizar contrato e telas.

**Aceite:** cópia externa cifrada recuperável sem a VPS original; alertas testados com destino autorizado; chave de recuperação acessível ao responsável; retenção documentada; papéis recebem apenas campos definidos e telas continuam funcionando.

## S10 — Gates, revisão e publicação

### Verificações obrigatórias

- Suite Django completa em SQLite e PostgreSQL 16; nenhum teste relevante de locks/concorrência pulado no gate PostgreSQL.
- Schema da API, migrations em banco limpo e em cópia descartável da versão anterior; nenhuma migration corretiva muda registros reais automaticamente.
- `manage.py check --deploy --tag security --fail-level WARNING` com configuração equivalente à produção e segredos artificiais.
- TypeScript, regressões mobile, export web, build das imagens e testes dos ambientes efetivos por serviço.
- QA web desktop/mobile e testes em Android/iOS para SecureStore, refresh, retomada, MFA e logout. QA browser não comprova armazenamento nativo.
- Controles negativos de autenticação/CSRF/revogação/igreja suspensa e positivos de acesso legítimo, onboarding, diretório, financeiro, mídia privada e recuperação.
- Teste PostgreSQL de rotação simultânea e contadores com workers concorrentes; verificação de múltiplas abas.
- Varredura de segredos no diff, histórico disponível, contexto/imagem e bundle usando valores sentinela; revisão de dependências com limitações registradas.
- `git diff --check`, revisão do diff completo e revisão final de segurança. Usar agentes adicionais somente se solicitado ou exigido por instrução aplicável.

### Lotes de implantação

| Lote | Conteúdo | Gate antes de publicar |
|---|---|---|
| A — contenção do host | S08 | Acesso de recuperação, diff, rollback temporizado e testes dos serviços compartilhados |
| B — correções compatíveis | S01–S04 | Regressões, imagens, env explícito, backup validado e migrations compatíveis |
| C — autenticação coordenada | S05–S07 | Clientes compatíveis, novo login planejado, MFA/recuperação preparados, QA completo |
| D — evolução operacional | S09 | Destino/chave/canal definidos, restore comprovado e matriz de dados validada |

Preparar migrations e interfaces de modo que o lote B possa ser revisado/publicado sem ativar prematuramente o protocolo do lote C. Uma mesma branch pode produzir commits/revisões de corte identificados; se um lote já tiver sido integrado, continuar a partir da base resultante e evitar misturar revisões no deploy.

Antes de cada lote: registrar versão atual, imagens alvo, backup recuperável, alterações exatas, evidências e condições de abortar. Depois: confirmar SHA backend/web, HTTPS, readiness, login/refresh/logout, funções afetadas e serviços compartilhados. Só encerrar achados operacionais depois da verificação em produção.

### Rollback

- Host: restaurar o diff de SSH/firewall/Monit preservado e usar console/sessão de recuperação; manter reversão automática até validar novo acesso.
- Aplicação: voltar apenas a uma revisão compatível com o schema e com o nível de segurança exigido; preservar volumes e novas tabelas quando possível, sem `down -v` ou reversão automática do banco.
- Autenticação: não reativar validação legada que ressuscite tokens revogados. Se não houver rollback seguro para o protocolo, suspender temporariamente o acesso afetado e corrigir adiante. Cookies antigos/nativos incompatíveis precisam de limpeza ou novo login definido no runbook.
- Credenciais: retirada do segredo administrativo do backend deve permanecer; rotação, se necessária, exige plano próprio para todos os consumidores, sem copiar valores antigos ao relatório.

## Commits sugeridos e acompanhamento

1. `test(security): add isolation and authentication regressions`
2. `fix(finance): scope related objects to authenticated church`
3. `fix(deploy): restrict service secrets and reject unsafe configuration`
4. `chore(deps): upgrade supported dependencies and security checks`
5. `fix(auth): share login limits and enforce active church`
6. `feat(auth): implement revocable sessions and secure client storage`
7. `feat(auth): enforce administrative MFA and recovery`
8. `fix(web): enforce security headers and block private paths`
9. `docs(ops): add verified VPS hardening and recovery procedure`
10. `feat(ops): add encrypted external backup and restore verification`
11. `fix(privacy): minimize member fields by role`
12. `docs(security): record final validation and remaining risks`

Regressões devem entrar com sua correção no lote revisável; se o primeiro commit registrar testes vermelhos para desenvolvimento, não publicar uma revisão quebrada como release.

Cada etapa terá status planejado/em execução/validado localmente/implantado/verificado, SHA, testes executados, limitações e vínculo com SEC correspondente. Encerramento do plano exige todos os dez achados verificados e complementos concluídos ou explicitamente aceitos como pendentes, com responsável/prazo.

## Decisões necessárias antes da ativação correspondente

| Decisão | Proposta inicial | Quando resolver |
|---|---|---|
| Base/nome da branch | Principal atualizada; `codex/security-hardening` | Início da execução |
| SSH administrativo | Chave + VPN/IP real; Monit por túnel | Antes de aplicar S08 |
| Nova sessão | Access 10 min, sessão absoluta 7 dias, corte com novo login | Antes do contrato final S05 |
| MFA | TOTP e recuperação, obrigatório para gestão sensível | Antes de ativar S06 |
| Backup externo | Cópia cifrada fora da VPS, preservando banco/mídia atuais | Antes de ativar S09 |
| Dados por papel | Matriz explícita com minimização por função | Antes de alterar contrato de membros |
| Consulta de dependências | Nomes/versões apenas, sem código/segredos | Antes de retomar consulta externa bloqueada |

Esses pontos não impedem entregar o plano nem iniciar correções locais independentes. Não interpretar ausência de resposta como aprovação de destino, custo ou alteração operacional.

## Fontes técnicas

- [Auditoria Moriah de 12/10/2026](auditoria-seguranca-2026-10-12.md).
- [Runbook atual KingHost](runbook-kinghost.md).
- [Django — versões suportadas](https://www.djangoproject.com/download/).
- [SimpleJWT — rotação, blacklist e configurações](https://django-rest-framework-simplejwt.readthedocs.io/en/stable/settings.html).
- [Django — proteção CSRF](https://docs.djangoproject.com/en/5.2/howto/csrf/).
- [Expo — SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), conferindo compatibilidade com o SDK efetivamente utilizado na implementação.
