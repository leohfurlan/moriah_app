# F11 — Divisão proposta para aprovação

09/10/2026. Fontes: [spec](spec.md), [contrato](contract.md), [plano](plan.md),
PRD v1.2/F11. Workflow `to-tickets`. **Divisão aprovada e implementada localmente**.
Nenhum tracker de publicação foi escolhido; não existem issues publicadas.
Cada fatia inclui persistência, API, interface e evidências de seu comportamento.
Tickets individuais em `.scratch/f11-onboarding/issues/`, com bloqueios em texto.
O responsável aprovou a divisão e autorizou implementação nesta conversa.

## 01 — Acolhida, perfil obrigatório e retomada

**Bloqueado por:** nenhum.

**Entrega:** login por senha/WhatsApp conduz ao perfil curto; preenchimento e
retomada no servidor, inclusive administrador sem Member. Apresentação pulável,
dados essenciais obrigatórios e guardas efetivas na API, web e Admin. A conclusão
fica integrada ao vínculo da fatia 02 antes da disponibilização pública.

- [ ] Nome/e-mail existentes e WhatsApp vinculado reaproveitados; nascimento e
  relação obrigatórios; datas inválidas/futuras rejeitadas.
- [ ] Rascunho sobrevive a logout e outro dispositivo; sair continua disponível.
- [ ] URL/API direta não contorna perfil incompleto; nenhuma guarda impede OTP,
  acesso ao próprio onboarding ou regularização da conta admin.
- [ ] Migração aditiva, admin sem Member e outra igreja cobertos em testes/API/UI.

## 02 — Conclusão pessoal com conferência automática de vínculo

**Bloqueado por:** 01.

**Entrega:** concluir como membro autodeclarado gera conferência humana, inclusive
quando a conta já tem perfil visitante; mostra a situação na jornada.

- [ ] Solicitação pendente reutilizada, vínculo confirmado preservado e duas
  requisições simultâneas não criam duplicatas.
- [ ] Revisão de vínculo aprovada/rejeitada demonstrada no ambiente isolado;
  visitante não é confirmação, não assume cadastro nem recebe permissões extras.
- [ ] Falha reverte conclusão sem perder rascunho; retry seguro após resposta perdida.
- [ ] Nascimento informado não sobrescreve cadastro oficial sem revisão.
- [ ] PostgreSQL, login legado e dependências de perfis visitantes preservados.

## 03 — Grade semanal e próximos passos por relação

**Bloqueado por:** 02.

**Entrega:** administrador cadastra grade semanal real; usuários veem cultos e
destinos conforme sua relação, com estados vazios úteis.

- [ ] Editor de dia/horário/local e ativação; validação, exclusão e isolamento.
- [ ] Visitante lê horários ativos, sem poder editar ou consultar outra igreja.
- [ ] Conhecendo: cultos/eventos; frequentando: também orientação de célula;
  membro: conferência e atalhos autorizados.
- [ ] Não exigir criação de eventos avulsos para representar grade semanal.
- [ ] Caminhos desktop/celular e ausência de cadastros demonstrados.

## 04 — Checklist compartilhado, percentual e card retomável

**Bloqueado por:** 03 (fornece grade e jornadas integradas).

**Entrega:** admin acompanha seis itens de configuração, compartilhados pela
igreja, e dispensa pessoalmente o card a 100%.

- [ ] Revisões confirmáveis com autor/data; quatro itens calculados por registros
  atuais; cadastros existentes contam; percentual correto de 0% a 100%.
- [ ] Duas contas admin veem mesmas conclusões; dispensa do card é individual.
- [ ] Remoção/desativação da condição volta a pendente e invalida dispensa anterior.
- [ ] Checklist permanece nas configurações; painel livre após conclusão pessoal.
- [ ] Seis itens fixos, sem “Não se aplica”; sem ações ou links não autorizados.
- [ ] Gates e aceite integrado R01–R12/E01–E14 documentados com evidências;
  migração ensaiada em base isolada, sem deploy nesta tarefa.

## Resultado

As quatro fatias foram aprovadas e implementadas; aceite e limitações estão no
[relatório](../../relatorio-implementacao-onboarding-2026-10-09.md).
As caixas acima preservam o checklist original; tickets individuais registram
conclusão. Nenhuma issue foi publicada em tracker externo.
