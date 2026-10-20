# F04 — Tickets de implementação, revisão 0.2

20/10/2026. Fontes: [spec](spec.md), [contrato](contract.md), [plano](plan.md). Implementação autorizada pelo usuário nesta conversa com alteração do CPF: coletar no pagamento e guardar para reuso, sem cadastro geral. Sem issues externas publicadas. Arquivos individuais em tickets/.

1. **Informar CPF na contribuição e guardá-lo privadamente.** Sem bloqueio cadastral/F02. Entrega validação, persistência criptografada e reutilização no pagamento. Aceite: CPF ausente na primeira emissão bloqueia chamada; CPF salvo permite próxima; troca não altera histórico; nenhum documento no diretório/extrato.
2. **Gerar e retomar QR Pix Cora.** Bloqueado por 01. Entrega página → API → adaptador mTLS → QR/Copia e Cola; idempotência, vencimento do dia e retomada explícita. Aceite: nenhuma receita na geração; erro/timeout preserva chave e intenção. Homologação externa bloqueada por credenciais.
3. **Enviar comprovante vinculado e revisar manualmente.** Bloqueado por 02. Entrega envio → tesouraria → extrato; aceite: upload validado, vínculo único, replay sem anexos duplicados e uma entrada após aprovação; legado preservado.
4. **Validar recuperação e integração real.** Bloqueado por 02/03. Testes locais e instruções operacionais; homologação stage e QA Android/iOS permanecem pendentes até credenciais/dispositivos disponíveis. Não inclui deploy.

Status e evidências atuais no relatório de validação; nenhum ticket deve ser declarado homologado apenas com mocks.
