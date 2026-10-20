# Implementação de segurança — 13/10/2026

Implementação local na branch `codex/security-hardening`, baseada em
`origin/master` `a999b88477066e16ec346f6bcdeef8996e853c2a`.
Worktree: `C:\Projetos TI\moriah_app\tmp\security-hardening`.
Checkout original e alterações anteriores preservados. Este documento registra
o aceite da implementação; a continuação autorizada inclui audit npm, publicação
da branch/PR e deploy. O registro da implantação será acrescentado ao final.

## Alterações entregues

| Etapa | Entrega | Estado |
|---|---|---|
| S00 | Baseline, worktree, fixtures e bancos descartáveis | Concluído localmente |
| S01 | Querysets de referências financeiras por igreja, validação de escrita/modelo/admin e verificador somente leitura | Implementado e testado |
| S02 | Allowlist de ambiente por serviço, exclusão da senha administrativa do backend/migrate, fail-fast para chave Django de exemplo, chave MFA separada, settings descartáveis de build | Implementado e testado |
| S03 | Django 5.2.18, DRF 3.18.3, SimpleJWT 5.5.1, pyotp 2.10.0 e cryptography 50.0.2; dependências transitivas com hashes; guard offline e audit npm no CI | Implementado; audit autorizado executado, riscos residuais registrados |
| S04 | Orçamento de login em banco compartilhado por aliases/workers/Admin, HMAC dos identificadores, proteção contra crescimento de contadores após bloquear IP e igreja ativa | Implementado e testado |
| S05 | Sessões revogáveis, access 10min, refresh rotativo com expiração absoluta 7 dias, logout, invalidação por senha/papel/igreja, links privados vinculados à sessão | Implementado e testado |
| S05 cliente | Access somente em memória, refresh web HttpOnly/Secure/SameSite Strict + CSRF, SecureStore nativo, exclusão de tokens antigos do AsyncStorage, single-flight e Web Locks entre abas | Implementado e testado |
| S06 | TOTP obrigatório para gestão/staff, sementes cifradas, prevenção de replay, recuperação de uso único, enrollment pela interface, proteção de senha/WhatsApp/Admin e reset operacional auditado | Implementado e testado |
| S07 | Bloqueio de dotfiles/mídia direta, cabeçalhos HTTP e CSP gerada a partir do bundle sem unsafe-eval | Implementado; QA com CSP aplicado |
| S08 | Templates SSH/Monit/Caddy, verificador somente leitura e procedimento de firewall/rollback na VPS compartilhada | Preparado; aplicação em produção pendente |
| S09 | Diretório reduzido por papel; backup cifrado com restic, vigia de atraso e restauração descartável | Código e ensaio local concluídos; destino externo/alertas pendentes |
| S10 | Suítes, schema, builds, browser, migrations e evidências | Publicado no PR #14 e implantado; detalhes abaixo |

O DRF foi atualizado também após consulta ao aviso oficial de exposição via
AdminRenderer ([GHSA-g47c-3xmw-q6m2](https://github.com/encode/django-rest-framework/security/advisories/GHSA-g47c-3xmw-q6m2)).
A API usa JSONRenderer. O lock universal é usado por testes e imagem para evitar
divergências das dependências transitivas.

## Evidências finais

| Verificação | Resultado |
|---|---|
| Backend PostgreSQL 16 | **349 passaram, nenhum pulado** |
| Backend SQLite | **340 passaram, 9 pulados**, todos os pulos de concorrência cobertos no PostgreSQL |
| Cliente `npm run typecheck` | Passou |
| Cliente `npm test` | **18 passaram** |
| Expo export | Web, Android e iOS gerados; bundles Hermes nativos compilados |
| Migrations | Nenhuma migration faltante; 0005 aplicada no banco descartável com papel sem privilégios administrativos |
| Schema OpenAPI | **0 erros**, 15 warnings (14 únicos), de hints/nomes de enum |
| Imagem backend | Build e collectstatic com settings descartáveis; dependências verificadas por hashes |
| Guardas de deploy | `check --deploy --tag security --fail-level WARNING`: nenhum problema com configuração descartável equivalente à produção |
| Imagem web | Build com Nginx e CSP aplicado no ensaio |
| Compose efetivo | Sentinelas confirmam senha administrativa somente no banco, fora de backend/migrate; segredos de backup ausentes |
| Papel de banco | `check_database_privileges` aprovou o usuário da aplicação de QA |
| Isolamento financeiro | API rejeita POST/PATCH cruzados; modelo rejeita referências externas; verificador de inconsistências aprovou |
| Git | `git diff --check` e guard offline de artefatos de credenciais passaram |

Testes de segurança cobrem refresh consumido apenas uma vez sob concorrência,
limite compartilhado sob disputa, aliases, expiração absoluta, revogação por
logout/senha/elevação de papel, igreja suspensa, JWT legado sem sessão, CSRF
com remoção do header, IP encaminhado falso, janela de recuperação do limite,
WhatsApp sem bypass MFA, código TOTP e recuperação de uso único, links privados
revogados e minimização do diretório em lista/detalhe.

Navegador Chromium local, sem produção: senha → enrollment TOTP → códigos de
recuperação → dashboard; reload recupera sessão via cookie; duas abas recuperam
sessão simultaneamente; logout seguido de reload mantém desconectado.
`localStorage` ficou sem tokens e `document.cookie` não expôs o refresh.
Visualização desktop e viewport 390×844 verificadas. Nenhuma violação CSP
observada nesse percurso. HTTP 401 sem sessão após logout é esperado; erros
iniciais 400 do bootstrap web foram corrigidos antes do ensaio final.

`/`, `/home` responderam 200 com cabeçalhos; `/.env`, `/.env.pilot`,
`/.git/config` e `/media/private.pdf` responderam **404**. A CSP de produção
começa em Report-Only; o ensaio local usou enforcement. Não foi feito um QA
visual completo de todas as telas com CSP.

Backup: restic 0.19.1, sem rede no ensaio, repositório local cifrado descartável,
dump e mídia fictícia. `check --read-data`, restore e checksums passaram.
Dump decifrado restaurado em outro banco: **3 usuários, 3 membros, 1 fator MFA
confirmado**, iguais à fixture. Não se trata de restauração de dados reais ou
destino externo. RTO de produção permanece sem medição.

Evidências brutas ignoradas pelo Git: `tmp/security/{postgres-final,sqlite-final,
schema-check,backend-build-final,native-export,backup-restore}.txt`, bundles em
`mobile/.expo/security-export`, snapshots em `.playwright-cli` e screenshot em
`output/playwright/security-mobile.png`. Somente dados/credenciais fictícios
foram usados nos recursos de QA. Os containers desta tarefa foram encerrados
ao final; as evidências e a worktree foram preservadas.

## Pendências para publicação e produção

1. Revisão/merge do [PR #14](https://github.com/leohfurlan/moriah_app/pull/14)
   seguem separados da implantação já autorizada. Commit e push concluídos.
2. Backend e web já publicados; chave Fernet separada preparada e cópia cifrada
   independente guardada no Windows. JWT antigos são recusados e todos precisam
   relogar. Contas de gestão devem cadastrar seu autenticador no primeiro acesso.
3. Ensaiar Android/iOS em aparelho real e rebuild nativo com SecureStore. Export
   Hermes e testes com mocks não comprovam comportamento do Keychain/Keystore
   em hardware, reinstalação, bloqueio de tela ou falha de armazenamento.
4. Confirmar operador/chave/CIDRs/VPN/console e janela antes de SSH/firewall.
   Validar serviços compartilhados, IPv6, Docker e rollback temporizado.
5. Monit foi revalidado: já escuta somente em 127.0.0.1:2812 e não respondeu
   externamente; não precisou de alteração. A cadeia de IP foi conferida e o
   flag de autenticação foi habilitado. Firewall/console seguem pendentes.
6. Escolher destino, custo, retenção, credenciais, custódia e canal autorizado
   para backup externo/alertas. O risco de perda integral da VPS permanece
   até ativar e ensaiar essa cópia fora do host.
7. Audit autorizado em 13/10/2026: 45 → **26 sinalizações**, sendo **zero críticas,
   20 altas e 6 moderadas**, após patches compatíveis e overrides de PostCSS
   8.5.30 e UUID 11.1.1 somente no xcode. Raízes remanescentes: braces,
   image-size, node-forge e sprintf-js na cadeia de build. Os sourcemaps web
   de QA foram verificados para distinguir código embarcado de ferramentas.
   A dependência query-string 7.1.3 foi explicitada porque Expo Router 5 a usa
   sem declará-la; decode-uri-component 0.5.0 corrige o DoS, com adaptação mínima
   da importação CommonJS/ESM aplicada por script com verificação de versão.
   Os testes cobrem Unicode, rota codificada e entrada percentual malformada.
   Também foi coberta a rotação CSRF ao autenticar no Django Admin.
   Não foi aplicado
   `--force` nem downgrade/migração incompatível do Expo. Detalhes no arquivo
   [npm-audit-2026-10-13.json](npm-audit-2026-10-13.json). O CI bloqueia críticas;
   não foi afirmada ausência total de vulnerabilidades.
8. Observar CSP Report-Only e validar outras telas antes de promover enforcement.
   Origens S3/R2 exigem política explícita e novo QA; a política testada é mesma
   origem. Web Locks foi validado no Chromium; navegadores sem suporte ficam
   com single-flight por aba e podem exigir novo login numa disputa de refresh.
9. Logout sem rede limpa credenciais locais, mas não comprova revogação remota.
   O cliente informa a falha e impede restauração automática. No nativo, após
   excluir a credencial não é possível revogar remotamente sem nova prova de
   autenticação; a sessão anterior expira ou pode ser revogada por operador.

Procedimento detalhado e matriz de campos: [runbook-seguranca.md](runbook-seguranca.md).
Plano original: [plano-correcao-seguranca-2026-10-12.md](plano-correcao-seguranca-2026-10-12.md).

## Publicação e deploy autorizados — 13/10/2026

- Commit principal: `888c52388f67`, com código de segurança e correções do audit.
- Correção de CI: `e8d708246e5c`, com lock completo e hashes também para pytest
  e dependências de teste. O pip foi validado em Linux antes da nova rodada.
- Branch publicada: `codex/security-hardening`; PR aberto:
  [#14](https://github.com/leohfurlan/moriah_app/pull/14), sem merge automático.
- Os cinco jobs passaram na revisão implantada:
  [CI 38397997926](https://github.com/leohfurlan/moriah_app/actions/runs/38397997926).
- Imagens imutáveis: `moriah-backend:e8d708246e5c` e
  `moriah-web:e8d708246e5c`. Arquivo de código e imagens transferidos por SSH;
  SHA256 comparado na VPS antes de carregar/extrair.
- Backup pré-deploy: `20261013T121726Z`, dump e mídia com checksums aprovados.
  Configuração anterior preservada em diretório privado, sem credenciais no Git.
- Chave MFA gerada na VPS e mantida no env 600. Cópia fora do host em
  `backups/security/mfa-key-e8d708246e5c.dpapi` nesta worktree, cifrada com
  **Windows DPAPI CurrentUser** e ignorada pelo Git. Essa cópia requer o mesmo
  usuário/perfil Windows para decifrar; não substitui política de custódia
  organizacional nem backup externo do banco/mídia. Nenhum segredo foi exibido.
- Rota real conferida no Caddy `fornada-evolution-proxy-1`: header Moriah de IP
  sobrescrito a partir do IP de cliente calculado pela cadeia restrita já
  configurada. Nenhuma alteração no proxy compartilhado. `AUTH_TRUST_CLIENT_IP=true`.
- `check --deploy --tag security --fail-level WARNING`, privilégios do papel
  PostgreSQL e isolamento financeiro passaram em produção. Nenhuma referência
  financeira inconsistente foi encontrada. Migration accounts 0005 aplicada.
- Somente backend/web Moriah foram recriados. O PostgreSQL existente foi
  preservado; os outros sistemas continuaram em execução, sem restart por esta tarefa.
- HTTPS `/health/ready/`: `ready`, revisão `e8d708246e5c`, banco `ok`.
  Backend e web saudáveis. Cabeçalhos verificados publicamente, CSP Report-Only.
  Dotfiles e mídia direta retornam 404. Imagem web sem Node, node_modules ou
  sourcemaps publicados.
- Smoke no código implantado: senha de conta operacional → desafio MFA →
  enrollment → cookie Secure/HttpOnly/Strict → refresh → logout → access negado.
  Os usuários/igreja/desafios/sessões temporários foram criados dentro de uma
  transação revertida integralmente; contagens anteriores e posteriores iguais.
  Nenhuma conta ou fator real foi modificado por esse teste.
- Chromium em HTTPS: tela pública de login renderizada. Refresh 401 na ausência
  de sessão é esperado. Não houve login em conta real nem cadastro de fator
  de usuário real pelo agente.
- Backup pós-deploy: `20261013T124330Z`, incluindo o schema novo e mídia.
- Monit: loopback confirmado e conexão HTTP externa sem resposta; estava
  corrigido na configuração corrente e não foi alterado por esta implantação.

Pendências preservadas: atualização/distribuição dos binários nativos, cadastro
MFA pelos gestores, revisão/merge do PR, CIDRs/operador/console para SSH/firewall,
destino/custódia/canal para backup externo e tratamento dos alertas residuais
da cadeia de build. A implantação não equivale a encerrar esses itens.


## Ajuste de MFA — 20/10/2026

Publicado o commit `24f972be2670`: MFA permanece obrigatório exclusivamente
para administradores (papel `admin` principal/adicional, `staff` ou `superuser`).
Tesouraria, secretaria, pastor, coordenação, liderança e membros seguem com
senha/WhatsApp sem segunda etapa, mesmo com fator antigo cadastrado. Desafios
pendentes deixam de ser aceitos após retirada dos privilégios administrativos.

- SQLite: 356 testes aprovados; nove testes exclusivos de PostgreSQL pulados.
- Cinco jobs de CI aprovados no código publicado, incluindo PostgreSQL:
  https://github.com/leohfurlan/moriah_app/actions/runs/39415711978
- Backups pré/pós-deploy verificados: `20261020T113232Z` e `20261020T113536Z`.
- Apenas backend atualizado para `moriah-backend:24f972be2670`; frontend continua
  `moriah-web:e8d708246e5c`. Nenhuma migração pendente; guardas de deploy aprovadas.
- HTTPS `/health/ready/`: `ready`, revisão `24f972be2670`, banco `ok`.
- Smoke em produção: administrador com MFA; seis outros perfis sem MFA;
  cookie seguro, refresh e logout. Todos os registros temporários revertidos.
- Chave MFA preservada. Configuração anterior guardada privadamente em
  `/var/backups/moriah/security-releases/24f972be2670/` para rollback.
- PR #14 atualizado e mantido aberto, sem merge.
