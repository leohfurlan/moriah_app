# Decisões de onboarding — Moriah

Data: 09/10/2026. Fonte: decisões do responsável pelo produto nesta conversa.
Status: jornada de membros e visitantes definida; formato da jornada administrativa
aprovado, com checklist e critérios de conclusão aprovados. Este registro complementa
o PRD e não representa implementação.

## Abrangência

- Primeira entrega exclusiva da Igreja Moriah.
- Duas jornadas: membros/visitantes e administradores, conforme permissões existentes.
- Progresso salvo, com retomada após interrupção.
- Apresentação dos recursos opcional; dados essenciais obrigatórios.
- Onboarding não concede cargos nem permissões administrativas.

## Jornada de membros e visitantes

1. Acolhida breve, apresentando a Moriah.
2. Conferência do perfil curto, reaproveitando os dados já informados no cadastro.
3. Próximos passos adaptados à relação com a igreja.

Perfil curto: nome, e-mail, WhatsApp já verificado, relação com a Moriah e
**data de nascimento obrigatória**. Foto, endereço e família ficam para depois.
A data de nascimento servirá ao mapeamento do perfil etário de membros e visitantes.
O administrador também deve completar os dados pessoais essenciais, incluindo
data de nascimento, antes de concluir sua acolhida. O responsável informou que
já vinculou o WhatsApp da conta administrativa atual; essa informação não foi
verificada na base nesta conversa. O onboarding deve reconhecer uma identidade
WhatsApp já verificada e vinculada, sem exigir novo código ou refazer o vínculo
apenas para concluir a jornada.

Pergunta: “Como você se relaciona com a Moriah?”

| Resposta | Próximos passos |
| --- | --- |
| Estou conhecendo a igreja | Horários dos cultos e próximos eventos |
| Já frequento, mas ainda não sou membro | Cultos, eventos e como participar de uma célula |
| Já sou membro | Situação da conferência cadastral e atalhos disponíveis |

Para “Já sou membro”, concluir o onboarding envia automaticamente uma solicitação
de vínculo para conferência da secretaria. Não duplicar solicitação pendente nem
solicitar novamente um vínculo já confirmado. A autodeclaração não confirma a
membresia e não concede permissões extras. Durante a espera, a pessoa continua
usando os recursos permitidos à sua conta.

## Contas existentes e atualização cadastral futura

Segundo o responsável pelo produto, atualmente apenas a conta administrativa
está cadastrada. Essa informação foi fornecida na conversa; não houve consulta
à base de produção para verificá-la. A primeira entrega pode avançar sem uma
campanha de regularização de membros existentes.

**Decisão para versões futuras:** quando houver necessidade de atualização
cadastral obrigatória, reutilizar o onboarding para conduzir os usuários abrangidos
pela solicitação até a conclusão dos dados exigidos. Não tratar essa atualização
como uma apresentação opcional.

Preservar dados existentes e vínculos confirmados; solicitar apenas a conferência
ou complementação necessária. A definição de público, campos, momento do bloqueio,
exceções e controle de conclusão de cada atualização ficará para a versão que
introduzir essa necessidade. Esse mecanismo futuro não está autorizado como
implementação imediata por este registro.

## Jornada administrativa

- Orientações acompanhadas de checklist das configurações.
- Exibir percentual de conclusão das configurações.
- Painel acessível desde o início, sem exigir conclusão prévia do checklist.
- Progresso salvo para permitir conclusão gradual e retomada.
- Respeitar as permissões existentes ao orientar e oferecer ações.
- Exigir os dados pessoais essenciais, incluindo data de nascimento, para
  concluir a acolhida individual do administrador. Essa exigência é separada
  do checklist compartilhado de configurações da igreja, que pode ser concluído
  aos poucos.

Checklist aprovado:

1. Revisar os dados da igreja.
2. Conferir a equipe e suas permissões.
3. Cadastrar os horários dos cultos.
4. Publicar o primeiro evento.
5. Cadastrar a primeira célula.
6. Cadastrar o primeiro ministério.

Critérios de conclusão aprovados:

- Os seis itens têm peso igual. Percentual = itens concluídos / 6 × 100.
  Calcular sobre a fração, sem somar parcelas arredondadas; seis itens concluídos
  correspondem a 100%.
- Dados da igreja: confirmação explícita do administrador de que revisou.
- Equipe e permissões: confirmação explícita do administrador de que conferiu.
- Horários dos cultos, primeiro evento publicado, primeira célula e primeiro
  ministério: conclusão detectada pelo sistema a partir dos registros existentes.
- Aproveitar configurações já prontas; não exigir recadastro para avançar.
- Checklist de configurações e percentual compartilhados pela igreja: uma
  configuração concluída por um administrador aparece concluída para os demais.
- Acolhida e orientações pessoais com progresso individual por usuário.
- A conclusão automática reflete a configuração atual. Se a remoção de um
  registro eliminar a condição necessária (por exemplo, remover a única célula),
  o item volta a pendente e o percentual compartilhado é recalculado.
- Na primeira versão, todos os seis itens são aplicáveis à Moriah. Não haverá
  opção “Não se aplica” nem exclusão de itens do cálculo; o denominador é seis.

Apresentação aprovada:

- Card no painel com percentual de conclusão, itens pendentes e botão
  “Continuar configuração”.
- Acesso permanente ao checklist nas configurações, inclusive após chegar a 100%.
- Ao atingir 100%, o administrador pode dispensar o card do painel.
- Se uma configuração voltar a ficar pendente e o percentual cair abaixo de
  100%, o card reaparece automaticamente, mesmo que tenha sido dispensado.

## Estado da definição

- Grade semanal própria de cultos aprovada, com dia, horário e local, também
  apresentada aos visitantes. Não substituir por eventos avulsos da agenda.
- Perfil pessoal obrigatório antes de acessar as demais telas, inclusive para
  administrador. Onboarding e saída da conta permanecem disponíveis. Concluir
  as configurações da igreja não é requisito de acesso ao painel.

As decisões de produto das jornadas pessoal e administrativa descritas neste
registro foram aprovadas na conversa. A atualização cadastral obrigatória foi
registrada como evolução futura. Requisitos consolidados na F11 do PRD v1.2;
especificação, contrato, plano e divisão proposta em `docs/features/F11-onboarding/`.
