# Complemento da Fase 5 — fundamentos transversais

**Data:** 17/09/2026

**Base:** `8872e3b` (`codex/moriah-navigation-admin`)

## Entrega

- Listas de eventos, extrato, contribuições, escalas, notificações, solicitações
  cadastrais, ministérios, candidatos e membros de célula aceitam
  `?page=N&page_size=N` e retornam o envelope DRF `count`, `next`, `previous` e
  `results`. O limite do cliente é 100 itens por página; sem esses parâmetros o
  formato legado em lista permanece compatível.
- O cliente adapta os dois formatos e exibe navegação de páginas nas listas de
  contribuições, escalas pessoais, gestão de escalas e notificações.
- Eventos, escalas pessoais, compromissos e contribuições de gestão ganharam
  filtros adicionais no backend (`q`, tipo, status, categoria e período,
  conforme o domínio).
- Conta autenticada sem `member_profile` pode solicitar revisão de vínculo. A
  solicitação usa o e-mail da sessão, registra eventual candidato da mesma
  igreja para conferência e nunca aceita `member_id` do cliente ou cria o
  vínculo automaticamente. A aprovação no Django Admin valida igreja,
  concorrência de vínculo e associa a conta ao cadastro.
- O boot inicial não chama `/me/` quando não existe access token.
- Mensagens centrais do cliente e rótulos de status foram normalizados para
  português com acentos.

## Evidência local

| Validação | Resultado |
|---|---:|
| Suíte backend SQLite | **135 passed, 3 warnings de depreciação** |
| Novos contratos transversais | **4 passed** |
| `manage.py check` | **PASS** |
| `makemigrations --check --dry-run` | **PASS — No changes detected** |
| `npm run typecheck` | **PASS** |
| `npm test` mobile | **11 passed** |
| `git diff --check` | **PASS** |

Ainda não foi executado nesta rodada o QA Playwright com Expo em execução, o
workflow CI/PostgreSQL nem o teste em Android/iOS. A migration
`members.0003_memberlinkrequest` precisa ser aplicada pelo fluxo de deploy
autorizado antes de usar o endpoint em ambiente externo.

## Gate

Este complemento fecha a implementação local das atividades de fundamentos da
Fase 5, mas não declara o gate da Fase 6. O QA integrado por papel e a
confirmação CI/PostgreSQL continuam sendo pré-condições; não houve merge,
deploy ou aplicação de migration externa.
