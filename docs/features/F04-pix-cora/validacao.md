# F04 — Validação local Pix Cora

20/10/2026. Implementação autorizada na conversa; sem commit, push, deploy, migração de produção ou chamada real ao banco.

## Entrega

CPF é solicitado na contribuição e guardado em PixPayer, criptografado com chave operacional Fernet separada do banco. User/Member/onboarding permanecem sem esse campo. O documento salvo é reutilizado nas próximas contribuições e pode ser substituído; snapshots antigos não são alterados.

Intenções Pix próprias e persistentes possuem chave idempotente Cora, configuração exclusiva por igreja/ambiente, QR gerado no servidor e Copia e Cola. Retomada de resultado incerto é explícita e usa o snapshot original. Geração não cria Contribution nem FinancialEntry. Comprovante vinculado preserva revisão manual e uma única entrada após aprovação. Origem Pix Cora identificada na revisão financeira.

Migração criada: finance.0005_pixpayer_pixintent, aplicada somente por runners de testes em bancos descartáveis. Configuração documentada em [configuracao.md](configuracao.md); integração desabilitada por padrão.

## Evidências executadas

| Checagem | Resultado |
|---|---|
| Suíte completa backend SQLite, `python -m pytest backend -q -c backend/pytest.ini` (raiz, uv Python 3.12 + requirements-dev) | 332 passaram; 8 casos de lock PostgreSQL pulados |
| Gate PostgreSQL 16: accounts/finance/schedules/audit/content/members, `--ds=config.settings_test_postgres` | 270 passaram; nenhuma falha/pulo; banco local descartável, porta 55439 |
| Tipos mobile, `npm run typecheck` | passou |
| Regressões mobile, `npm test` | 13 passaram |
| Exportação web Expo | passou; inclui expo-clipboard, expo-crypto e react-native-svg |
| `makemigrations --check --dry-run --settings=config.settings_test` | nenhuma migração faltante |
| `manage.py check --settings=config.settings_test` | nenhuma questão |
| Schema spectacular | comando terminou 0; 84 erros de introspecção (8 únicos) em views fora deste escopo e 16 warnings; não é schema limpo. Novas operações Pix possuem serializers e respostas explícitas |
| `git diff --check` | passou, avisos de normalização LF/CRLF no lock/package |
| Navegador Playwright, respostas locais sintéticas | CPF no formulário, header de idempotência presente, QR SVG exibido, categorias travadas após geração, comprovante vinculado e aviso de confirmação manual; Copia e Cola mostrou sucesso; largura 390×844 inspecionada |

Testes específicos cobrem CPF inválido/ausente/reuso, criptografia, validação monetária, isolamento, flag desligada, replay/conflito, timeout/resposta incompleta, vencimento, recuperação com snapshot original após troca de CPF, duas gerações simultâneas com uma chamada bancária, comprovante obrigatório/duplicado e aprovação repetida com uma receita. Teste do transporte verifica certificado/chave, token, payload PIX e chave idempotente sem rede.

Warnings do backend incluem diretório staticfiles ausente nos runners e avisos existentes de configuração de banco em testes. `npm install` reportou 45 alertas de dependências; não foi executado audit fix nem atualização ampla fora do escopo.

## Limites reais

Não há credenciais Cora disponíveis nesta execução. Portanto, autenticação mTLS, resposta real da invoice, leitura do QR por banco e limites da conta ainda precisam de homologação stage. Mocks e QR sintético não demonstram cobrança autorizada. Android/iOS nativos ainda precisam de QA com build atualizado pelas dependências Expo adicionadas; a inspeção em largura de celular foi feita no navegador.

Não foram executados deploy checks com infraestrutura real, stack piloto completa ou migração no banco da igreja. Não há webhook, consulta bancária nem baixa automática. Intenção vencida não é tratada como cancelada. Configurar a igreja, favorecido, credenciais, arquivos privados e chave de dados antes de habilitar em ambiente autorizado.

## Integração com a versão publicada — 20/10/2026

Antes do deploy foi identificado que produção usa o backend 24f972be2670 e web e8d708246e5c, ambos da linha de segurança do PR #14, ainda não incorporada à master. O Pix foi integrado com origin/codex/security-hardening (2a0e3a9), preservando isolamento de referências financeiras, sessões revogáveis, MFA apenas para administradores, cookies/CSRF, SecureStore, dependências corrigidas e allowlist de variáveis do Compose. O novo PR tem essa branch como base para mostrar somente o acréscimo Pix.

Resolução: FinancialEntry mantém clean/save de isolamento; PixPayer/PixIntent são acrescentados após a classe existente. Cryptography permanece na versão 50.0.2 da segurança; qrcode 8.2 foi adicionado aos locks com hashes. Lock npm preserva overrides de segurança e acrescenta dependências Pix. A allowlist do Compose agora inclui CORA_* com habilitação false por padrão.

Revalidação da integração: 380 testes PostgreSQL passaram; SQLite 370 passaram e 10 foram pulados por exigirem PostgreSQL. Tipos, 18 regressões mobile, exportação web com /backend e headers de segurança passaram. Teste adicional de sessão real para Pix passou, incluindo rejeição após logout (15 testes Pix passaram, 1 pulado em SQLite). Sem migrações faltantes; guards de segredos e allowlist Compose passaram.

Backup pré-deploy 20261020T121326Z: dump e mídia com checksums verificados; pg_restore executado com exit-on-error em PostgreSQL 16 isolado sem rede. Migrações e tabelas verificadas; nenhum dado alterado no banco principal pelo ensaio.
