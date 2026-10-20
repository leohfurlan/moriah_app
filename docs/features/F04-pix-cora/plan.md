# F04 — Plano Pix Cora, revisão 0.2

20/10/2026. PRD v1.2/F04. [Spec](spec.md), [contrato](contract.md), [tickets](tickets-propostos.md). Usuário autorizou implementação e definiu CPF coletado na contribuição, salvo no financeiro para uso posterior, fora do cadastro geral.

1. Registro privado de pagador, validação CPF, criptografia e configuração por igreja. Sem migração de Member/User nem aprovação cadastral.
2. Jornada completa de geração/retomada na página de contribuições: intenção persistida antes do HTTP, token/mTLS, QR local, Copia e Cola, vencimento do dia e recuperação explícita com mesma chave.
3. Comprovante vinculado, revisão humana e entrada financeira única. Preservar o fluxo legado; nunca reconhecer receita ao gerar QR.
4. Verificar API, privacidade, contrato do adaptador, concorrência PostgreSQL, tipos, bundle e regressões; documentar configuração. Homologação real depende das credenciais/chave Pix da igreja; produção não autorizada nesta tarefa.

Implementação local não equivale a integração homologada. Fixtures não demonstram resposta real do banco. CPF acompanha os registros privados financeiros sem rotina automática de descarte; backups precisam preservar a chave de criptografia separada do banco. Não remover dados financeiros em rollback: desabilitar novas emissões e manter comprovantes/histórico.
