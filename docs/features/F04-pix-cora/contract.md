# F04 — Contrato Pix Cora

Revisão 0.2 proposta, 20/10/2026. PRD v1.2/F04; base `f95d5798343fed88f3833f6e6b968765ad03f85e`. [Spec](spec.md), [plano](plan.md). Implementação local nesta revisão; homologação Cora pendente.

## Donos e dependências

| Fornecedor → consumidor | Fronteira e identidade | Situação |
|---|---|---|
| F01 → F04 | sessão, igreja, capacidades | implementada; permissões atuais em accounts.permissions |
| F02 → F04 | identidade Member | implementado; sem extensão de CPF |
| Cora → F04 | token, criação invoice, ID externo/EMV | documentado; não homologado |
| F04 → F08 | intenção Pix e comprovante | proposto neste contrato |
| F04 → F07 | contribuição pending e revisão manual | fluxo existente, vínculo Pix aditivo proposto |

IDs de membro/igreja vêm da sessão; cliente não escolhe destinatário, conta, church_id ou member_id. IDs externos são devolvidos pela Cora e persistidos pelo backend. Recurso fora da igreja/membro retorna 404. Gestor financeiro não recebe acesso irrestrito ao CPF por já acessar contribuições.

## CPF privado do financeiro — decisão confirmada

Nenhum campo em User, Member, onboarding ou solicitação cadastral. `cpf` opcional no POST de geração; obrigatório quando não existir documento salvo em PixPayer para aquele membro/igreja. Normalizar pontuação, validar dígitos e rejeitar caracteres estranhos. Salvar criptografado via Fernet/CORA_DATA_KEY no ato da contribuição; dado novo substitui o CPF reutilizável sem alterar intenções anteriores. Cada intenção mantém snapshot criptografado para replay exato. Não expor CPF em serializer/diretório/extrato/logs. `GET /api/contributions/pix-intents/config/` retorna enabled, has_saved_cpf e cpf_suffix (últimos dois dígitos ou null). Escopo privado do membro autenticado.

## API Moriah proposta

### Criar intenção

`POST /api/contributions/pix-intents/`, JWT e perfil de membro na igreja habilitada. Header `Idempotency-Key` UUID obrigatório. JSON inclui `cpf` string opcional (até 18 caracteres com pontuação); `amount` string decimal canônica (`"10.00"`), `category` enum atual de Contribution. Campos desconhecidos rejeitados; CPF vem do pagamento ou do registro privado anterior; nome vem do membro; sem observações pessoais enviadas à Cora.

Valor 5,00..99.999.999,99 e duas casas no máximo; quantidade de centavos calculada exatamente. `due_date` do servidor em America/Sao_Paulo, sem possibilidade de sobrescrever. Persistir chave e payload antes da chamada. Unicidade de chave por igreja/membro; UUID para Cora é gerado/persistido pelo backend e não pode colidir entre escopos. Repetição compara dados canônicos; divergência 409. Replay bancário usa mesmos dados originais, sem recarregar CPF alterado. CPF explícito divergente em replay retorna 409.

Resposta 201 quando pronta; replay pronto 200. Corpo: `id` UUID local; `state` (`creating`, `ready`, `uncertain`, `error`); `amount` string; `category`; `due_date` ISO date; `recipient_name` string de configuração verificada; `emv` string ou null; `provider_status` string ou null; `contribution_id` ID existente ou null. EMV só disponível em ready válido. Não devolver token/CPF/resposta bancária completa. Campos de invoice Cora são internos nesta revisão.

202 para operação ainda em andamento/incerta, corpo com mesmo ID e estado. Cliente preserva chave/ID e oferece retomar. Não ficar emitindo novas tentativas em loop. Retomada bancária explícita: POST `/api/contributions/pix-intents/{id}/retry/`, sem corpo. Usa snapshot e chave Cora originais, após erro/resultado incerto; creating só pode ser retomado após dois minutos. Operação concorrente recebe 202; ready retorna 200. Vencimento passado ou ambiente diferente retorna 409 e exige verificação operacional. Sem consulta de pagamento.

### Retomar intenção local

`GET /api/contributions/pix-intents/{id}/`: JWT, somente proprietário e igreja; 200 com corpo acima; 404 para inacessível. Não consulta banco Cora nem atualiza pagamento; campo calculado `past_due` boolean determina aviso de vencimento, sem inferir cancelamento. Frontend preserva navegação para recuperação entre sessões e apresenta intenções próprias por listagem paginada proposta no mesmo endpoint base, `GET`, usando convenção de paginação do projeto. Resposta de detalhe também fornece qr_svg gerado localmente a partir de EMV, ou null. Listagem limitada às 50 intenções mais recentes e omite EMV; detalhe fornece QR quando vigente.

### Enviar comprovante

`POST /api/contributions/` mantém multipart atual e recebe `pix_intent_id` opcional. Para vínculo Pix: intenção própria ready, valor e categoria derivados do servidor; se cliente enviar valores divergentes, 400. Comprovante obrigatório e validado no backend; manter regras de extensão, tamanho e assinatura existentes. Data declarada do pagamento segue `contribution_date` atual, não a data automática de geração do QR. Campos de revisão permanecem read-only.

Uma intenção possui no máximo uma Contribution. Transação curta/constraint assegura unicidade; 201 inicial e 201 replay, mesma Contribution sem anexar novamente. Contribuição permanece pending. Só aprovação por gestor chama criação idempotente de entrada. GET de intenção passa a retornar contribution_id; UI impede novo envio para a mesma intenção. Caminho legado sem vínculo permanece compatível.

### Erros e compatibilidade

Erros de campo usam formato DRF existente, ex.: `{"amount":["O mínimo para Pix Cora é R$ 5,00."]}`. Erros operacionais novos: `{"code":"cora_unavailable","detail":"Não foi possível gerar o Pix.","intent_id":"UUID ou null"}`. Códigos: `pix_disabled` (503), `idempotency_conflict` (409). Validação usa erros de campo (400). Resposta bancária inválida/ambígua retorna intenção uncertain (202, error_code=cora_unavailable); rejeição bancária 400/415 retorna intenção error (202, error_code=cora_rejected). 401 sem autenticação, 403 sem perfil, 404 recurso alheio. Timeout após envio pode retornar 202 com state uncertain, nunca sucesso pronto. Não repassar corpo bruto de erro Cora ou PII. Resposta ausente/ambígua preserva intenção, inclusive quando o servidor não consegue responder ao app.

## Adaptador Cora — fonte externa

Referências oficiais na [spec](spec.md). Resumo contratual, não transcrição da documentação:

- Operação: POST `/v2/invoices/`, apenas `payment_forms: ["PIX"]`. Host apresentado na referência genérica é `https://api.stage.cora.com.br`; para Integração Direta a orientação específica usa `https://matls-clients.api.stage.cora.com.br`. Não copiar a duplicação de barra do render da referência; conferir canonicalização e endpoint na homologação. Host de produção confirmado nas instruções iniciais: `https://matls-clients.api.cora.com.br`. Adaptador aceita apenas host correspondente ao ambiente, sem redirects.
- Integração Direta: certificado e chave privada em todas as requisições, validação TLS ativa; POST `/token` form-urlencoded com grant_type=client_credentials e client_id. Bearer na criação. Usar expires_in retornado, sem fixar duração do exemplo; não presumir client_secret. Credenciais diferentes por ambiente.
- Headers de emissão: Authorization Bearer, Content-Type e Accept application/json, Idempotency-Key UUID persistente.
- Payload: code = identificador local da intenção; customer.name aprovado, até 60; customer.document.identity = CPF somente dígitos e type=CPF; services com um item name/description neutros (description até 100) e amount inteiro em centavos; payment_terms.due_date YYYY-MM-DD. Não enviar endereço/e-mail/notificações opcionais, multa, juros ou desconto.
- Resposta documentada: id, status, total_amount, total_paid, created_at, pix.emv e payment_options.bank_slip.url (PNG apesar do nome bank_slip). Verificar EMV, ID e igualdade de total_amount com valor solicitado. O texto também denomina o objeto PixResponse: homologar a estrutura efetiva `pix.emv` antes de fixar fixtures definitivas.
- Estados publicados: DRAFT, OPEN, IN_PAYMENT, LATE, CANCELLED, PAID. Nesta entrega, nenhum deles aprova Contribution. Estado desconhecido/resposta incompleta não deve liberar QR; DRAFT sem EMV é indisponibilidade, sem introduzir consulta automática.
- Mínimo publicado: R$5; conta precisa ter chave Pix. Documentação admite erros genéricos para documento/e-mail inválidos. Não classificar todo 5xx como ausência de criação.
- Garantia documentada de Idempotency-Key evita duplicidade na repetição. Prazo de retenção e recuperação de resposta devem ser validados no stage; não afirmar garantia ilimitada.

Não haverá chamada Cora para consultar, cancelar, transferir ou obter extrato. GETs citados acima pertencem ao Moriah. Não haverá armazenamento de credenciais no Expo ou variáveis EXPO_PUBLIC.

## Prova de compatibilidade

Fixtures sintéticas indicam fonte/data e cobrem resposta válida, ausência EMV, divergência, erros e timeout. Testes de contrato verificam payload, mTLS, autorização, chave estável e isolamento. Testes públicos cobrem transições da spec e ausência de receita na geração. Evidência real exige credenciais stage da modalidade confirmada, conta com chave Pix e leitura do código; mocks não demonstram autorização bancária. CPF pertence a F04; não altera User, Member ou onboarding. Extensões são aditivas, sem remoção dos estados/rotas legados.
