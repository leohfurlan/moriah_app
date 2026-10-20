# Configuração operacional Cora Pix

Implementação desabilitada por padrão. Não foram usadas credenciais nem feitas chamadas bancárias nesta tarefa.

1. Instalar dependências backend/mobile atualizadas e aplicar a migração finance.0005 no ambiente de teste autorizado.
2. Montar certificado e chave privada da Integração Direta em arquivos privados no container backend. Definir CORA_CERT_PATH e CORA_KEY_PATH com caminhos internos, sem expor ao frontend.
3. Definir CORA_CLIENT_ID, CORA_CHURCH_ID (ID exato da Igreja Moriah) e CORA_RECIPIENT_NAME (titular da conta confirmado), sem fallback para outras igrejas.
4. Gerar CORA_DATA_KEY uma única vez com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Guardar em segredo operacional e backup separado; trocar/perder a chave impede ler CPFs existentes. Não gravar a chave no Git.
5. Stage: CORA_ENVIRONMENT=stage e CORA_BASE_URL=https://matls-clients.api.stage.cora.com.br. Produção usa environment=production e https://matls-clients.api.cora.com.br, com certificado/chave próprios. Não misturar credenciais.
6. CORA_ENABLED=true habilita exclusivamente a igreja configurada. A conta precisa ter chave Pix. Desabilitar bloqueia emissão/retentativa, mantendo histórico e envio de comprovantes.

O token é obtido a cada tentativa; não há cache compartilhado. Requisições HTTP têm timeout de 20 segundos cada e não seguem redirects. Nenhum corpo de erro bancário é entregue à UI.

Uma intenção incerta pode ser retomada explicitamente, no mesmo dia e ambiente, com o snapshot e chave originais. Creating recente aguarda até dois minutos para evitar disputa com requisição em curso. Após vencimento, verificar com a tesouraria; não emitir outra cobrança automaticamente. QR vencido não significa cancelado. A confirmação financeira continua manual, com comprovante.

CPF salvo pertence ao contexto financeiro, não ao cadastro geral. Novo documento informado substitui apenas o registro reutilizável; snapshots históricos ficam preservados. O nome do pagador continua vindo do cadastro vinculado. O CPF completo não é retornado pelo app nem exibido na tesouraria.

Fontes: [QR Pix](https://developers.cora.com.br/reference/qr-code-pix-v2), [autenticação](https://developers.cora.com.br/docs/client-credentials-int-direta), [ambientes](https://developers.cora.com.br/docs/instrucoes-iniciais), consultadas em 20/10/2026.
