# Implementação F11 — Onboarding Moriah

Data: 09/10/2026. Estado: implementação local; sem commit, push ou deploy.
Fonte: [PRD v1.2/F11](../PRD_Moriah_App_v1.md),
[decisões aprovadas](decisoes-onboarding-2026-10-09.md),
[spec](features/F11-onboarding/spec.md), [contrato](features/F11-onboarding/contract.md).

## Entrega

- Acolhida breve e perfil curto com nascimento e relação com a Moriah obrigatórios.
  Nome/e-mail existentes reaproveitados; nome da conta corrigível; WhatsApp
  verificado reaproveitado, com opção de vínculo quando ainda não existir.
- Rascunho salvo no servidor e retomado após recarregar ou entrar em outra sessão.
  Progresso pessoal independente do cadastro oficial de membro.
- Perfil obrigatório antes das demais telas e APIs de dados, incluindo Admin
  Django e acesso por links de arquivos privados assinados. Autenticação, vínculo
  WhatsApp, próprio onboarding e saída permanecem disponíveis.
- Solicitação automática de conferência para autodeclarados membros. Visitante
  associado à conta não é confirmação de membresia. Pendências deduplicadas,
  vínculo confirmado preservado e conclusão transacional, sem atribuição de papel.
- Secretaria pode confirmar o próprio perfil visitante ou associar cadastro
  oficial existente. A associação preserva atividades e solicitações; colisões de
  registros retornam conflito, sem alteração parcial. O cadastro anterior fica
  preservado e desvinculado. Nascimento oficial não é substituído sem revisão.
- Grade semanal própria de cultos com dia, horário, local, edição, ativação e
  exclusão. Visitantes consultam horários ativos, sem permissão de edição.
- Próximos passos com eventos, orientação de célula e situação cadastral.
- Checklist da igreja com seis itens e percentual compartilhados; revisões
  manuais com autor/data, demais itens calculados pelos cadastros atuais.
- Card dispensável a 100%, reaparecendo abaixo de 100%, mesmo se a configuração
  for removida e restaurada entre consultas. Checklist permanente nas configurações;
  acolhida e dispensa individuais.
- Links de cadastros existentes usam Admin Django quando não há editor próprio.
  Os cadastros vinculados ao checklist foram restringidos à igreja da sessão.
- CI PostgreSQL ampliada para incluir accounts e suas regressões de concorrência.

## Arquivos centrais

- `backend/apps/accounts/onboarding.py` e `onboarding_views.py`: estado,
  conclusão, progresso, validação e APIs.
- `onboarding_middleware.py`, `onboarding_signals.py`, `config/private_media.py`:
  guardas e invalidação das dispensas.
- `backend/apps/members/linking.py`: revisão e associação segura de visitantes.
- `backend/apps/events/models.py`: ServiceTime; migração events/0004.
- `backend/apps/accounts/models.py`: OnboardingProfile/ChurchSetup; migração accounts/0004.
- `mobile/src/screens/OnboardingScreen.tsx`, `ServiceTimesScreen.tsx`,
  `components/ChurchSetup.tsx` e rotas onboarding/settings/welcome/service-times.
- `backend/apps/accounts/tests/test_onboarding.py`: contrato, permissões,
  concorrência, revisão, card e tentativa de bypass por arquivos privados.
- `tools/qa/scripts/f11-onboarding.mjs`, `seed-f11.py`, `f11-fixtures.py`: aceite
  real com dados sintéticos; scripts Python recusam outro banco/porta.

## Validação

Ambiente isolado: imagem local Python 3.12, código montado para leitura, PostgreSQL
16 exclusivo `moriah_f11` e banco separado `moriah_f11_schema` para ensaio de migração.
Nenhuma conexão ou alteração em produção. Django criou seu próprio banco de testes.

| Verificação | Resultado |
| --- | --- |
| Suíte completa PostgreSQL | 302 testes passaram, incluindo locks reais |
| Suíte completa SQLite / Python 3.12 | 295 passaram; sete testes de concorrência pulados, executados no PostgreSQL |
| TypeScript | `npm run typecheck` passou |
| Regressões mobile | 13 testes passaram |
| Bundle web | Exportação Expo de produção passou |
| Django check | Sem problemas |
| Migrações pendentes | `makemigrations --check --dry-run`: nenhuma |
| Migrações novas | Aplicação, reversão e reaplicação passaram em base vazia descartável |
| Navegador desktop/celular | Fluxo em 1440×1000 e 390×844, com capturas inspecionadas |
| Integridade textual | `git diff --check` passou |

QA cobre nascimento futuro rejeitado, rascunho retomado, deep link bloqueado,
admin sem Member, identidade já vinculada, grade semanal, confirmações, 100%,
dispensa, reaparecimento a 83%, solicitação automática de visitante e edição
negada ao visitante. Os registros de evento, célula e ministério são fixtures
sintéticas para comprovar detecção de cadastros existentes; seus editores não
foram reimplementados.

A repetição do aceite identificou uma corrida entre a tela de conclusão e a
atualização da sessão: clicar imediatamente em “Configurar a igreja” podia voltar
ao onboarding. Corrigido exibindo as ações somente após atualizar o estado de
autenticação e mantendo-as desabilitadas durante a conclusão.

Evidências locais regeneráveis: `tmp/f11-pytest-postgres.txt`,
`tmp/f11-pytest-sqlite.txt`, `tmp/f11-browser-qa.txt`, `tmp/f11-migrations.txt`,
`tmp/f11-schema-check.txt`, `tmp/f11-web-build.txt`; imagens em `output/playwright/f11/`.

## Limitações e publicação

- `spectacular --validate` concluiu, mas registra 76 mensagens de erro em sete
  views antigas de WhatsApp/arquivos sem serializer, além de avisos de enums e
  métodos antigos. Não é um schema integralmente limpo. As novas APIs F11 têm
  request/response declarados; não houve erros atribuídos às views F11.
- Python 3.14 do Windows apresentou incompatibilidade Django 5.1/template e
  restrições da pasta temporária. A validação de referência usa Python 3.12 em
  container, como a CI.
- QA mobile em navegador responsivo; não houve teste em app Android/iOS instalado.
- Não houve envio real de WhatsApp: identidades sintéticas já vinculadas no QA;
  o transporte de autenticação permanece o existente.
- Futuras campanhas obrigatórias de atualização cadastral permanecem evolução
  documentada, sem implementação nesta entrega.
- Publicação requer migrar antes de servir o código e coordenar backend/app:
  contas incompletas serão direcionadas ao onboarding. A conta admin real
  aproveitará seu WhatsApp vinculado, mas precisará completar o perfil.
  Nenhuma migração real, commit, push ou deploy foi executado.
