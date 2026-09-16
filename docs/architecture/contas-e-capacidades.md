# Contas e capacidades

Uma conta do Moriah pode acumular papéis. O papel principal existente continua
identificando a conta para compatibilidade; papéis adicionais somam
capacidades e não substituem o papel principal.

O `member_profile` é opcional na conta, mas é obrigatório para qualquer recurso
pessoal de membro. A autorização administrativa, inclusive a de superusuário,
nunca substitui nem cria implicitamente uma identidade de membro.

## Regras de experiência

- Conta com `member_profile`: acessa perfil, contribuições, escalas e agenda
  próprios.
- Conta com `member_profile` e capacidades de gestão: mantém a experiência de
  membro e também pode acessar as operações autorizadas.
- Conta administrativa sem `member_profile`: acessa somente a gestão; as rotas
  pessoais devem ficar ocultas ou desabilitadas na interface.
- `/admin/` permanece disponível para manutenção técnica, mas não é o painel
  de produto nem destino automático de líderes ou administradores.

O endpoint de identidade informa papéis e capacidades para que cada cliente
monte sua navegação pela capacidade real. A interface de troca entre “Área do
membro” e “Painel de gestão” poderá ser adicionada futuramente na mesma conta.
