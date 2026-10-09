# Implantação do Moriah na KingHost — plano e status

> Atualização aprovada durante a execução: tudo na VPS, incluindo PostgreSQL
> exclusivo e arquivos privados em volume persistente; domínio
> `app.igrejamoriah.com`. Neon/S3/R2 abaixo descrevem a proposta inicial.
> Para a topologia e operação finais, seguir [runbook KingHost](runbook-kinghost.md).

Data: 08/10/2026. Destino verificado por SSH: `atos-pd`, hostname
`atospd.vps-kinghost.net`. Decisão recomendada: **piloto interno nesta VPS,
condicionado aos gates abaixo; ainda não liberar produção**.

Este documento atualiza a escolha de host do plano Oracle/Neon. A inspeção
remota foi somente leitura. Não houve deploy, migração, alteração de proxy,
commit ou push. Domínio, banco remoto e bucket ainda precisam ser confirmados.

## 1. Evidências atuais

Base local: branch `codex/finance-contribution-ledger`, HEAD `136845f`.
Há seis arquivos rastreados alterados e scripts QA não rastreados anteriores
a esta auditoria. As correções de capacidades, guardas de rotas e QA existentes
foram preservadas. Os resultados abaixo incluem esse working tree e não
representam somente o commit HEAD; fechar a revisão antes de gerar a release.

| Verificação em 08/10 | Resultado |
|---|---|
| Backend, SQLite isolado, Python local 3.14 | 217 passaram; 2 falharam |
| `npm run typecheck` | Passou |
| `npm test` | 12/12 passaram |
| Export Expo web com `EXPO_PUBLIC_API_URL=/backend` | Passou; bundle de 3,1 MB e index gerados; artefato em `tmp/kinghost-web-audit` |
| `git diff --check` inicial | Passou |
| Docker local | Acesso ao daemon negado pelo ambiente; stack não revalidada |
| PostgreSQL, navegador desktop/mobile, APK | Não revalidados nesta auditoria |

Comando backend: `python -m pytest -q --tb=line --disable-warnings`, com
`TEMP`/`TMP` apontando para `tmp/audit-tests` no workspace. Antes desse ajuste,
quatro testes de arquivos também falharam por permissão no temporário do Windows;
passaram sem alteração de código ao usar diretório gravável.

Export executado em `mobile/`: `npx expo export --platform web --output-dir
dist-kinghost-audit`; resultado movido para `tmp/kinghost-web-audit` após a
geração. A primeira tentativa de exportar diretamente fora de `mobile/` foi
recusada pelo Expo. Build bem-sucedido não substitui QA visual/funcional.

Falhas remanescentes: `backend/apps/members/tests/test_phase5_transversal.py`,
testes `test_lista_paginada_explicitamente_preserva_escopo_e_limita_tamanho` e
`test_eventos_aceitam_filtro_de_tipo_e_rejeitam_data_invalida`. Criam eventos em
01–03/10/2026; `MyChurchEventsView` filtra a partir de agora menos um dia.
Em 08/10, a lista fica vazia e a segunda página retorna 404. Ajustar fixtures
para datas relativas, mantendo assertions de paginação, filtros e isolamento.
Não alterar o filtro de negócio para fazer os testes passarem.

## 2. Capacidade e convivência no host

Snapshot: Ubuntu 24.04.4 LTS, 6 CPUs, 7.936 MiB de RAM total, 5.626 MiB
disponíveis, swap 1.023 MiB sem uso; disco 166 GB, 133 GB livres; load
0,09/0,09/0,15. É uma amostra, não medição de pico nem ensaio de carga.

Já rodam Nexor Fiscal (web, workers, Postgres e Redis), Nexor Simulador e
Evolution (API, Postgres e Redis). O container `fornada-evolution-proxy-1`
ocupa 80/443, com configuração montada de `/opt/evolution-fornada/Caddyfile`.
Portas locais já utilizadas incluem 18000, 18001, 18010, 18080 e 8081.

**Parecer:** há folga aparente para um grupo pequeno. Reutilizar esta VPS evita
provisionar outra máquina e aproveita HTTPS/Docker existentes. O risco central
é compartilhar CPU, memória, disco e proxy com sistemas em uso: um incidente
do host afeta todos. Não há alta disponibilidade.

Orçamento inicial proposto (validar sob carga): backend com 2 workers,
limite 1 CPU/768 MiB; servidor web estático com 0,25 CPU/128 MiB. Construir
imagens e bundle fora da VPS. Alertar sobre OOM, swap crescente, disco acima
de 80% e RAM disponível abaixo de 1,5 GiB. Esses números são limites de partida,
não capacidade garantida. Reavaliar na primeira semana e antes de expandir.

## 3. Funcionalidades da primeira release

“Implementado” não significa homologado no destino. Liberar somente os fluxos
abaixo após os testes e aceite da seção 5; não prometer a totalidade do PRD.

| Área | Recorte implementado candidato ao piloto | Aceite obrigatório |
|---|---|---|
| F01 — identidade | Login JWT, refresh, capacidades e isolamento por igreja | Logout/expiração, conta sem vínculo, recusa de acesso entre igrejas |
| F02 — membros | Perfil, diretório de membros/visitantes e solicitações de vínculo; administração existente | Secretaria versus membro, vínculo revisado, privacidade |
| F03 — células | Consulta do líder, reuniões/presenças e administração existente | Líder restrito à própria célula; operar pelo admin/API onde não há tela dedicada |
| F04 — financeiro | Contribuições, comprovantes, extrato, revisão e gestão de lançamentos | Aprovação/rejeição, lançamento idempotente, escopo pastoral/tesouraria, anexo privado |
| F05 — escalas | Criar/publicar/cancelar, candidatos, integrantes, substituição, confirmação/recusa e detalhe de música | Coordenador limitado ao ministério, conflito de horário, resposta do membro |
| F06 — agenda | Eventos, agenda e compromissos pessoais | Corrigir datas dos testes, paginação e privacidade dos compromissos |
| F07 — operação | Django Admin e telas de gestão existentes | Grupos sincronizados; `is_staff` sozinho não concede acesso |
| F08 — membro | Interface web responsiva, perfil, extrato, agenda, escalas e notificações internas | Desktop e celular; caminhos acessíveis pelo menu, não apenas URL direta |
| Conteúdo e avisos | Conteúdo/Palavras e avisos de eventos no código atual | Publicar, editar, arquivar, permissões e QA fase 6 |

Fora desta release: F09 WhatsApp, F10 Projetos Sociais, escola bíblica/turmas
e telas placeholder de ministérios, bandas, repertório e setlists. Dados de
ministérios/músicas usados por escalas continuam no fluxo existente; isso não
equivale a disponibilizar aqueles módulos completos. Publicação em lojas e
push externo não integram o piloto. APK interno via EAS fica para uma etapa
posterior à homologação web, com URL HTTPS absoluta no build.

## 4. Arquitetura fechada para preparar o piloto

```text
Navegador -> HTTPS -> Caddy existente (80/443)
                       -> servidor de bundle Expo estático
                       -> /backend/*, /api/*, /admin/*, /static/* -> Django
Django -> PostgreSQL Neon exclusivo do Moriah, TLS
       -> S3/R2 privado para arquivos
Backups -> destino externo ao host, com restauração ensaiada
```

Manter Neon como proposta do plano anterior; sua existência/configuração não
foi confirmada. Não reutilizar bancos ou credenciais do Nexor/Evolution. Se
preferir Postgres local para evitar Neon, registrar outra decisão: container,
volume e usuário próprios, limite de recursos e backup externo obrigatório;
essa alternativa ainda não integra o plano aprovado.

- Projeto Compose `moriah-piloto`, diretório `/opt/moriah_app`; nenhum comando
  global de prune, down de outros projetos ou reprovisionamento do host.
- Não aplicar o cloud-init Oracle nem ativar o perfil `proxy` do Compose atual:
  tentaria ocupar portas já usadas. Preparar override KingHost com recursos,
  web estático e integração ao proxy existente.
- Preferir rede Docker dedicada entre proxy e gateway Moriah, sem anexar os
  bancos de outros projetos. Usar alias exclusivo `moriah-piloto-web`. Validar
  e persistir a associação no Compose que administra o proxy, sem recriá-lo
  abruptamente. Se escolhido upstream por porta de host, lembrar que
  `127.0.0.1` dentro do Caddy é o próprio container, não a VPS.
- Backend pode usar `127.0.0.1:18020` para diagnóstico (livre no snapshot;
  revalidar). Não publicar 5432 nem expor Gunicorn diretamente.
- Web: exportar Expo com `EXPO_PUBLIC_API_URL=/backend`. O gateway deve
  **preservar** `/backend/` ao encaminhar ao Django, pois a rota já existe.
  Servir bundle e fallback de SPA; `/api`, `/backend`, `/admin`, `/static` e
  `/health/` nunca devem cair no fallback HTML. `/static/` segue no WhiteNoise.
- O Compose atual só entrega backend: a montagem/servidor do bundle ainda
  precisa ser implementada. O Caddyfile comentado não é publicação web pronta.
- Segredos exclusivos; `DEBUG=false`, hosts e origens exatos, proxy HTTPS
  confiável, storage privado e URL assinada. Revisar também folders/avatares,
  além dos comprovantes. Não copiar `.env.pilot` local para o servidor.

## 5. Sequência executável e gates

| Etapa | Trabalho | Evidência para avançar |
|---|---|---|
| 0 — fechar release | Revisar alterações pendentes, incluir QA fase 6, corrigir fixtures com datas vencidas; separar scripts de debug | Revisão limpa identificada por SHA; backend, tipos e regressões verdes |
| 1 — empacotar | Criar override KingHost, gateway web e artefatos imutáveis backend/web com o mesmo SHA | Build Linux/Python 3.12, export web e `check --deploy` no ambiente correto |
| 2 — homologar local | PostgreSQL isolado e QA fases 1–6; testar desktop/celular, rotas diretas e contas positivas/negativas | Relatório sem falhas críticas; financeiro, conteúdo e agenda cobertos |
| 3 — preparar serviços | Confirmar domínio/DNS, Neon exclusivo, bucket, orçamento, responsáveis e usuários do piloto | TLS e acesso privado comprovados; segredos fora do Git |
| 4 — preparar host | Validar capacidade, rede e proxy; criar diretório/serviço isolados; configurar logs e backup | Diff concreto do proxy validado, rotas atuais preservadas, imagens presentes |
| 5 — implantação autorizada | Backup; checagens; migration explícita; sync de permissões; subir backend/web; validar/recarregar Caddy | SHA correto, HTTPS, health, login, estáticos e fluxos mínimos aprovados |
| 6 — recuperação | Backup externo, restore em banco descartável e rollback de backend/web | Dados conferidos, anexos persistem após redeploy; rollback documentado |
| 7 — piloto interno | Grupo pequeno por 7 dias, sem seed público; acompanhar erros e consumo | Relatório de uso/incidentes e decisão de ampliar ou corrigir |

Etapas 0–4 não autorizam publicação. Etapa 5 depende de autorização de deploy
e dados, após fechamento dos gates. Não rodar o QA que cria dados contra outros
sistemas nem contra banco real sem escopo definido.

Comandos-base para a janela autorizada (Bash, após preparar o override):

```bash
cd /opt/moriah_app
export APP_REVISION=<SHA-validado>
dc() { docker compose -p moriah-piloto -f docker-compose.pilot.yml \
  -f docker-compose.kinghost.yml --env-file .env.pilot "$@"; }
dc --profile tools run --rm migrate python manage.py check --deploy
dc --profile tools run --rm migrate python manage.py migrate --plan
# Prosseguir somente com backup e compatibilidade das migrations conferidos.
dc --profile tools run --rm migrate
dc --profile tools run --rm migrate python manage.py sync_role_permissions
dc up -d --no-build backend web
dc ps
```

`docker-compose.kinghost.yml` e o serviço `web` são entregáveis pendentes,
portanto esse bloco ainda não deve ser executado. Criar o administrador por
canal interativo seguro; não executar `seed_mvp` no ambiente publicado.

## 6. Correções operacionais necessárias antes do deploy

1. Compose atual consulta `/health/ready/` a cada 30 segundos. Esse endpoint
   executa SQL e pode impedir suspensão do Neon. Trocar o healthcheck periódico
   para `/health/`; checar readiness no deploy e em diagnósticos controlados.
2. `unhealthy` não reinicia automaticamente um container com `unless-stopped`.
   Definir alerta e procedimento de recuperação, sem prometer autoheal.
3. `compose up` com uma réplica e porta fixa pode interromper atendimento.
   Planejar manutenção curta; não prometer zero downtime. Blue/green só se
   implementado e ensaiado.
4. Usar exatamente as mesmas imagens e SHA no migrate e backend. Manter imagem
   e bundle anteriores disponíveis; não reconstruir uma tag antiga a partir
   do checkout novo durante rollback.
5. A unit systemd atual inicia só backend. Adaptar a versão KingHost para os
   mesmos arquivos Compose/projeto e serviço web. Não gerenciar o proxy global
   pelo serviço do Moriah.
6. `check --deploy` pode terminar com warnings: reprovar warnings de segurança,
   storage efêmero e origens HTTP; documentar separadamente avisos de schema.

## 7. Rollback e operação

Antes da janela, registrar SHA anterior, imagens, bundle, backup e configuração
do proxy. Em falha de login, isolamento, upload ou 5xx persistente: suspender
novos acessos do piloto, voltar backend e web juntos à release anterior,
revalidar health e leitura; preservar logs. No primeiro deploy, rollback é
retirar apenas a rota do Moriah e seus serviços. Não executar rollback SQL
automático; alterações incompatíveis exigem restauração em banco separado e
decisão explícita sobre eventuais escritas posteriores ao backup.

Backup diário fora da VPS, retenção inicial de 30 dias e alerta de falha.
Testar restauração antes de admitir dados reais, incluindo recuperação dos
arquivos do bucket. Liveness pode ser monitorado periodicamente; consultas
ao banco devem considerar custo e suspensão. Registrar latência, 5xx, OOM,
disco, custo Neon/storage e impacto nos sistemas existentes. Responsável
operacional e contato de incidente precisam ser definidos antes da liberação.

## 8. Pendências de decisão

- Domínio do piloto e acesso ao DNS.
- Projeto/branch Neon e bucket S3/R2 a usar, região e teto de custo.
- Responsável operacional, grupo piloto e autorização de dados reais.
- Revisão final das permissões pastorais de financeiro e conteúdo.

O plano está concluído; a execução e a homologação ainda estão pendentes.

## Fontes

Inspeção local e SSH em 08/10/2026, comandos e resultados descritos acima.
Histórico consultado: `docs/relatorio-estado-para-producao-2026-09-24.md`;
os testes antigos não foram contados como validação atual.

- [KingHost — VPS Linux/Docker e acesso root](https://king.host/servidor-vps)
- [Docker — políticas de reinício](https://docs.docker.com/engine/containers/start-containers-automatically/)
- [Docker — estado do healthcheck](https://docs.docker.com/engine/containers/run/)
- [Neon — gerenciamento de compute e suspensão](https://neon.com/docs/manage/endpoints/)
