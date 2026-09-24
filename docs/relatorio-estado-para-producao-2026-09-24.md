# Estado do código e caminho para produção — 2026-09-24

Auditoria feita por comando direto sobre o repositório (não a partir de relatórios
anteriores, que estão defasados). Serve como base para a Etapa 0 da retomada:
consolidar o repositório antes de qualquer trabalho de infraestrutura.

## 1. Estado verificado

Branch no momento da auditoria: `codex/finance-contribution-ledger`
(HEAD `407dff5`, 2026-09-18 10:09), com 15 arquivos modificados e 20 não
rastreados na árvore de trabalho.

### Verde

- `pytest` no backend: **80 passed, 1 failed**.
- `npm run typecheck` no mobile (`tsc --noEmit`): passa.
- `manage.py makemigrations --check --dry-run`: *No changes detected* — nenhuma
  migração pendente.
- `manage.py check --deploy` com `DJANGO_DEBUG=false`: apenas `security.W009`
  (chave de teste usada na verificação) e avisos de `drf_spectacular`. O
  endurecimento de produção já está em `backend/config/settings.py`: HSTS de
  1 ano, cookies secure, redirect SSL, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` e `SECURE_PROXY_SSL_HEADER` atrás de flag.
- Auditoria: `backend/apps/audit/signals.py` grava `AuditLog` em contribuição,
  membro e escala; `backend/apps/content/views.py` registra publish/unpublish.
  O item "auditoria exigida pelo PRD não está implementada" do relatório de
  2026-07-06 está **resolvido**.
- Storage S3/R2 com URLs assinadas (`querystring_auth`, 900s) atrás de
  `USE_S3_STORAGE`; `scripts/backup_postgres.sh` e o de restore; CI no GitHub
  Actions (pytest + spectacular + check + typecheck); `mobile/app.json` e
  `eas.json` prontos para build de produção.
- README atualizado com o que está pronto nesta entrega.

### Vermelho

**Um teste falhando, e não é regressão de código:**

`backend/apps/events/tests/test_event_api.py:31` cria o evento em 20/09/2026 e a
view filtra `start_at__gte=timezone.now() - timedelta(days=1)`. Em 24/09 a lista
volta vazia e o assert falha. A fixture é dependente de data — precisa usar data
relativa (`timezone.now() + timedelta(...)`).

## 2. Bloqueador principal: não existe revisão implantável

O trabalho está em quatro linhas divergentes. Nenhuma contém o produto inteiro.

| Linha | Commit / data | Tem | Não tem |
|---|---|---|---|
| `origin/master` | `4219d40` — 17/09 18:46 | 16 commits das Fases 0–5: `Feedback.tsx`, `navigation.ts`, `+not-found.tsx`, notificações persistentes, paginação, ministérios, date pickers, `docs/qa` fase 1–5 e o harness `tools/qa` | `backend/apps/content`, `FinancialEntry`/conciliação, avisos de evento, `finance-management` |
| `codex/finance-contribution-ledger` (branch atual) | `407dff5` — 18/09 10:09 | base `40ebc25` (16/09 11:18) + 1 commit de 42 arquivos (+1792/−87): Fase 6 conteúdo, financeiro e avisos | tudo do bloco acima: `tools/qa`, `Feedback.tsx`, `navigation.ts`, `+not-found.tsx`, `docs/qa` fase 1–5 |
| `codex/moriah-navigation-admin` | `bf2af12` — 17/09 21:16 | implementação **paralela** do mesmo `backend/apps/content`, com `tests/test_content.py` (138 linhas) | a implementação da linha atual tem `test_content_api.py` no lugar |
| árvore de trabalho | não commitado | 15 modificados + 20 não rastreados: 9 rotas placeholder, `PeopleDirectoryScreen`, `Markdown.tsx`, `CONTEXT.md`, `docs/features/F-PS-01`, `docs/qa` (evidências) e o próprio plano do piloto | qualquer commit — não é reproduzível nem auditável |

Consequência prática: um deploy hoje publica ou um app sem as correções de
confiabilidade/navegação das Fases 1–2 (sem `+not-found`, sem `Feedback`, sem
`navigation.ts`), ou uma versão sem financeiro/conteúdo.

## 3. Fase 1 do plano do piloto: 0 de 10 entregáveis

Plano: `docs/architecture/plano-arquitetura-oracle-neon-piloto.md`
(§11 lista os entregáveis, §8 os critérios de aceite).

| Entregável (§11) | Situação |
|---|---|
| `docker-compose.pilot.yml` | não existe (só o de desenvolvimento) |
| Runtime de produção | `backend/Dockerfile` usa `CMD runserver`; `gunicorn`/`uvicorn` ausentes do `requirements.txt`; o compose roda `migrate && seed_mvp && runserver` em todo boot |
| Configuração do Neon documentada | ausente |
| Configuração do storage S3/R2 documentada | parcial (variáveis no `.env.example`, sem runbook) |
| Runbook de deploy e rollback | ausente |
| Runbook de backup e restauração | ausente (existem apenas os scripts) |
| Health check e checagens de deploy | não existe endpoint `/health/` |
| Atualização do `.env.example` | sem bloco Neon/`SSLMODE`; `POSTGRES_SSLMODE` e `CONN_MAX_AGE` ausentes também em `settings.py` |
| Testes de regressão | existem (19 arquivos), mas com 1 falha |
| Evidências do primeiro deploy e restauração | nenhuma |

Critérios de aceite §8 já atendidos no código: `check --deploy` limpo,
`DJANGO_DEBUG=false`, hosts/CORS/CSRF restringíveis por env, migrações
versionadas, comprovante em S3 privado com link temporário.
Pendentes: seed não rodar a cada reinício, health check, HTTPS/DNS/SSH da VPS,
restauração testada, rollback executado.

## 4. PRD §13 (Segurança e LGPD) — o que ainda não tem lastro

Atende: HTTPS (pronto no Django, depende da infra), senhas pelo Django,
permissões por perfil, auditoria financeira e de membros, restrição a dado
financeiro individual (URLs assinadas), backup (script).

Falta implementar ou decidir:

- política de retenção de comprovantes;
- consentimento do membro para armazenamento de dados;
- agendamento do backup e alerta de falha;
- verificação de que os logs não expõem dados sensíveis.

## 5. Escopo

As 9 telas placeholder (`mobile/src/screens/ModulePlaceholderScreen.tsx`, texto
"Esta área está preparada para receber os próximos fluxos administrativos") para
`bands`, `setlists`, `repertoire`, `bible-school`, `classes`, `members`,
`ministries`, `visitors` e `finance-management` contrariam o plano §7/§11
("não criar apenas shells de navegação"). F10 Projetos Sociais está fora do MVP
(PRD §7.6); `docs/features/F-PS-01` é spec em rascunho, não trabalho de release.

Higiene: `.codex-remote-attachments/` e `tmp/` (este já ignorado) não devem ir
para o repositório.

## 6. Ordem de execução

### Etapa 0 — consolidar (bloqueia todo o resto)

1. merge de `origin/master` no branch de trabalho e resolução dos conflitos;
2. decidir qual implementação de `content` permanece e trazer os testes da que
   perder;
3. corrigir o teste de evento (data relativa) até 81/81 verde;
4. commitar a árvore de trabalho (docs, features, `CONTEXT.md`, plano do piloto)
   e decidir o destino dos placeholders;
5. push e PR com CI verde.

### Etapa 1 — adaptação local (Fase 1 do plano)

6. Gunicorn e Dockerfile de produção;
7. `docker-compose.pilot.yml` (5432 não exposta, sem serviço mobile, sem seed no
   boot);
8. `/health/` e `check --deploy` no CI;
9. `POSTGRES_SSLMODE=require`, `CONN_MAX_AGE` e `.env.example` atualizado;
10. separar migrate de seed (seed apenas por comando manual);
11. runbooks de deploy/rollback e de backup/restore, com backup agendado e alerta.

### Etapa 2 — provisionar e pilotar

12. VPS Oracle + Neon + R2/S3 + DNS/HTTPS;
13. primeiro deploy controlado, migração na branch correta do Neon;
14. testar restore e rollback em recurso descartável;
15. publicar o mobile (EAS) apontando `EXPO_PUBLIC_API_URL` para a API pública;
16. relatório do piloto com evidências (§8 do plano).

## Resumo

O código está bem mais avançado que o relatório de 2026-07-06 sugere —
auditoria automática, storage S3/R2, endurecimento de produção, CI e 80 testes
passando. Mas não há hoje **uma** revisão que contenha as Fases 0–6 juntas, e
nada da árvore de trabalho está commitado. O caminho para "online" começa pela
consolidação do repositório, não pela infraestrutura.
