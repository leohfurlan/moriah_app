# F11 — Contrato v1

09/10/2026; **aplicado localmente, sem deploy**. Fonte: [PRD v1.2](../../../PRD_Moriah_App_v1.md).
[Spec](spec.md) · [Plano](plan.md). Este documento define a nova interface;
as APIs existentes preservam seus dados e permissões, com a guarda obrigatória
de perfil descrita abaixo aplicada também aos acessos existentes.

## Provedores, consumidores e autoridade

| Provedor → consumidor | Dados / operação | Estado e autoridade |
| --- | --- | --- |
| F01 → F11 | User, Church, WhatsAppIdentity, capacidades | Implementado em accounts; igreja sempre deriva da sessão |
| F02 → F11 | Member, MemberUpdateRequest, MemberLinkRequest | Implementado; abertura/revisão de visitantes integrada com segurança |
| F03/F05 → F11 | Existência de Cell e Ministry | Modelos implementados; consultar exclusivamente igreja autenticada |
| F06 → F11 | Event ativo; horários de cultos | Event e grade semanal implementados localmente |
| F11 → F07/F08 | Estado pessoal e checklist | Endpoints abaixo implementados; nenhuma capacidade concedida |

IDs de membro vêm de `/me/` e do serviço de vínculo, nunca de um ID livre enviado
pelo usuário. IDs de igreja não são parâmetro deste contrato. F11 não altera o
contrato de revisão `member-link-requests/{id}/review/`; amplia internamente a
abertura para o caso visitante, mantendo escopo, auditoria e revisão humana.

## Convenções

Rotas relativas às bases existentes `/backend/` e `/local-api/`; verificar o
encaminhamento `/api/` no gateway antes da integração. JWT obrigatório.
401 sem sessão; 403 sem igreja ou capacidade; 400 validação DRF com mapa de
campos para listas de mensagens, ou `detail` para erro geral; 409 conflito com
`detail`. Erros inesperados 5xx não significam conclusão: reler GET e retentar.
Corpos desconhecidos, `user_id`, `church_id`, papéis e flags de conclusão enviados
pelo cliente são rejeitados com 400. IDs numéricos positivos. Datas `YYYY-MM-DD`.
Nenhuma paginação para o estado único pessoal ou checklist fixo de seis itens.

## Estado pessoal

`GET me/onboarding/` → 200:

```json
{
  "version": 1,
  "journey": "personal",
  "step": "profile",
  "status": "in_progress",
  "profile": {"name": "Pessoa Exemplo", "email": "pessoa@example.invalid", "birth_date": null, "relationship": null},
  "whatsapp_verified": true,
  "completed_at": null,
  "member_link": {"state": "none", "request_id": null},
  "next_actions": []
}
```

- journey: `personal|admin`, decidido por is_admin_user; status:
  `not_started|in_progress|completed`; step: `welcome|profile|next_steps|done`.
- relationship: `discovering|attending|member`, nulo apenas no rascunho.
- birth_date: data válida até hoje na data local da aplicação; nulo apenas antes
  de concluir. Nunca inferir nascimento ausente nem criar idade mínima.
- Nome/e-mail seguem limites e unicidade do cadastro existente. O onboarding
  reaproveita esses dados; mudanças em e-mail/identidade não são aceitas por esta
  API, usando processos existentes. Nenhuma prova de identidade por coincidência.
- member_link.state: `none|pending|confirmed|rejected`; request_id positivo ou
  nulo. Um Member visitante sozinho não produz `confirmed`.
- next_actions: lista de `{key,label,route}` com rotas permitidas à sessão;
  destinos sem módulo real produzem orientação textual na tela, sem link inválido.

`PATCH me/onboarding/` aceita subconjunto de `{name, birth_date, relationship, step}`;
name não vazio até 150 caracteres atualiza o nome da conta, sem sobrescrever o
nome oficial do Member. E-mail permanece cadastral e somente leitura nesta API.
persiste rascunho e retorna estado 200. Não aceita step=done nem reabre conclusão.
Dados inválidos retornam 400 sem alteração parcial. welcome/profile/next_steps
podem ser revisitados antes de concluir; pular apresentação não dispensa dados.

`POST me/onboarding/complete/`, corpo `{}` → 200 com estado completo.
Exige perfil essencial válido e WhatsAppIdentity da própria conta/igreja.
Transação única para conclusão e solicitação automática se relationship=member:
vínculo confirmado é preservado; pendente reutilizada; ausente cria pendência;
rejeição prévia não vira aprovação e admite nova solicitação somente nesta
primeira conclusão. Repetir conclusão retorna o estado sem criar outra solicitação.
Concorrência com revisão deve preservar unicidade e dados do cadastro confirmado.

O backend decide conclusão, nunca AsyncStorage ou campo cliente. Nascimento
pessoal informado não substitui nascimento do Member sem revisão. Se divergente,
criar/reutilizar MemberUpdateRequest equivalente e apresentar a pendência.
Confirmar perfil não concede novas capacidades nem muda Member.status.

Enquanto status!=completed, somente rotas de autenticação (login, refresh,
logout se disponível, verificação/vínculo WhatsApp), leitura de `/me/`, rotas
pessoais `me/onboarding/` e subrota `complete/` são permitidas à sessão na API.
Demais rotas de dados retornam 403 com `code: onboarding_required` e `detail`.
No app, permitir login, onboarding e saída; deep links voltam ao onboarding
após salvar o destino permitido. Após conclusão, revalidar a permissão antes
de navegar ao destino. Health, estáticos e schema não são dados pessoais e não
recebem esta guarda. Admin Django deve direcionar a conta incompleta à jornada
web antes de operar cadastros; não bloquear login/logout nem endpoints da jornada.
Testar essa exceção para evitar impedir a própria regularização do admin.

## Checklist da igreja

`GET church/setup/` → 200 apenas is_admin_user com church_id:

```json
{"completed_count": 0, "total_count": 6, "percentage": 0, "card_visible": true,
 "items": [{"key": "church_review", "completed": false, "mode": "confirmation", "action_url": null}]}
```

items sempre contém seis entradas ordenadas: `church_review`, `team_review`,
`service_times`, `first_event`, `first_cell`, `first_ministry`. Cada entrada tem
key, completed booleano, mode=`confirmation|automatic`, action_url string ou nulo.
action_url só aponta para destino acessível, incluindo Admin apenas com autorização
efetiva; caso contrário a UI orienta sem link. count inteiro 0..6; percentage
arredondado para inteiro de count/6×100; não aceitar edição de percentage.

- church_review/team_review: confirmação explícita persistida com autor/data.
- service_times: ao menos um horário semanal ativo cadastrado na igreja.
- first_event: proposta `Event.active=true` na igreja; não exigir folder.
- first_cell/first_ministry: ao menos um registro atual da igreja.
- card_visible: true abaixo de 100%; a 100%, false após dispensa individual.
  Uma queda invalida dispensa anterior; retornar a 100% requer nova dispensa.

`POST church/setup/confirm/` corpo `{ "item": "church_review" }` ou team_review
→ 200 com checklist atualizado. Outros itens → 400. Repetição é idempotente.
`POST church/setup/dismiss/` corpo `{}` → 200 com checklist, só se percentage=100;
caso contrário 409. Dispensa afeta apenas usuário autenticado, nunca toda a igreja.
Leituras recalculam itens automáticos; refresh ao voltar de cadastro e ao retomar app.
Nenhuma exclusão automática de registros ou publicação por completar checklist.

## Compatibilidade e conformidade

### Grade semanal de cultos (interface nova)

`GET church/service-times/` → 200, lista sem paginação de horários ativos da
igreja da sessão, ordenada por weekday/time/id. Disponível a toda conta com
onboarding completo, inclusive visitante. Retorna registros com
`{id,weekday,time,location,active}`: weekday inteiro 0=segunda a 6=domingo;
time `HH:MM`, location string não vazia até 255 caracteres; active booleano.

`POST church/service-times/` → 201 com registro; `PATCH church/service-times/{id}/`
→ 200; `DELETE church/service-times/{id}/` → 204. Escrita exclusiva de
is_admin_user na própria igreja. POST exige weekday/time/location, active
opcional com default true; PATCH aceita subconjunto, mas nunca church/id.
Enum inválido, horário inválido, local vazio e duplicata de weekday/time/location
na igreja retornam 400 sem alteração. ID ausente ou de outra igreja retorna 404.
Não cria eventos ou divulgações. Editor administrativo permite ver inativos por
`GET church/service-times/?include_inactive=true`; visitante recebe 403 nessa opção.
Atualizar/desativar/excluir afeta a próxima leitura do checklist. Admin pode
preencher a grade depois de concluir o próprio perfil. Lista vazia orienta
consultar a secretaria, sem inventar horários.

APIs de dados novas são aditivas; a guarda obrigatória altera o acesso de contas
incompletas e exige rollout coordenado de backend/app e sessão Admin. Acessos por
senha/WhatsApp são mantidos. Revisão de vínculo
e alterações cadastrais preservam revisão humana. Validar produtores via API real,
consumidores pelo app em desktop/celular e concorrência em PostgreSQL isolado.
Conformidade por API, PostgreSQL e navegador registrada no
[relatório](../../relatorio-implementacao-onboarding-2026-10-09.md).
