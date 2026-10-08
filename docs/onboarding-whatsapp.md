# Cadastro e acesso por WhatsApp

O acesso principal pede o número de WhatsApp e envia código de seis dígitos pela
instância exclusiva `Igreja Moriah` da Evolution API. Quem tem identidade verificada
entra direto; quem ainda não tem conta preenche nome e e-mail após validar o código.
Nova conta recebe papel de usuário comum e perfil de visitante. Nenhum cadastro
existente de membro ou conta administrativa é reivindicado por telefone/e-mail.
A secretaria confere a situação do visitante e atualiza seu cadastro no Admin.

Contas existentes continuam entrando com e-mail e senha. No Perfil, use
“Vincular WhatsApp para entrar sem senha”, receba o código e confirme o vínculo.
Só uma sessão autenticada pode vincular o número à conta existente. A identidade
verificada é independente dos campos de contato e única por igreja/número.
Troca de número exige sessão autenticada e validação do novo número. Perda de
acesso deve ser tratada pela administração; não existe recuperação automática
por um e-mail ainda não verificado.

O código vale por cinco minutos, é consumido uma vez e bloqueado após cinco erros.
Reenvio exige 60 segundos e invalida o código anterior somente após envio aceito.
O servidor limita cinco envios por número/hora, vinte por IP/hora e cem globais/hora.
A prova de cadastro vale dez minutos e só pode concluir uma conta. Locks no
PostgreSQL protegem tentativas, consumo, cadastro e limites entre workers.
Código e prova são guardados como HMAC, sem plaintext no banco/logs.

Configuração: `WHATSAPP_AUTH_ENABLED`, `WHATSAPP_AUTH_CHURCH_ID`,
`EVOLUTION_API_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY` somente no servidor.
O envio usa o [contrato de mensagens da Evolution API](https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/routes/sendMessage.router.ts).
Falha de transporte invalida o desafio e retorna 503 sem retry automático;
aceitação pelo transporte não prova recebimento ou leitura no aparelho.

Na KingHost, o Caddy sobrescreve `X-Moriah-Client-IP` com `{client_ip}` e o gateway
nginx encaminha como `X-Real-IP`. Só após configurar essa cadeia ative
`WHATSAPP_TRUST_CLIENT_IP=true`. A porta do backend fica em localhost. Não
confie diretamente em `X-Forwarded-For` fornecido pelo público.

Metadados OTP expirados são removidos diariamente antes do backup (retenção mínima
de um dia); identidades verificadas permanecem. Backup local inclui as novas tabelas.
Não há envio de divulgação nem webhook de conversa neste fluxo. E-mail é dado
cadastral não verificado; só a posse do WhatsApp autoriza o novo acesso.

Endpoints nas bases `/api` e `/backend`: `auth/whatsapp/request`, `verify`,
`register`, `link/request` e `link/verify`, todos com barra final. Requisição retorna
desafio/expiração/reenvio; verificação retorna JWT ou prova para cadastro. Vínculo
retorna apenas confirmação. Tokens/códigos/provas nunca são parâmetros de URL.

Validação: suíte completa em PostgreSQL (incluindo uso concorrente de código e
cadastro), TypeScript e regressões mobile. O verificador
`tools/qa/scripts/whatsapp-onboarding.mjs` recusa hosts de produção e usa backend
real com transporte fictício local, cobrindo desktop/celular, erro de código,
cadastro, logout e novo login. Credenciais/demo não são copiadas para produção.
