# Implantação das correções de segurança

Branch `codex/security-hardening`, base `origin/master` em `a999b88`. Estes passos
não foram aplicados à VPS. Referência: auditoria/plano de 12/10/2026.

## Release coordenada de autenticação

1. Fazer backup verificável de banco, mídia e configuração privada. Registrar
   hashes das imagens anterior/nova e ensaiar restauração em recursos separados.
2. Gerar **no servidor** uma chave Fernet separada (`Fernet.generate_key()`),
   guardar como `MFA_ENCRYPTION_KEY` no arquivo privado 600 e manter cópia sob
   custódia independente. Não trocar a chave Django nesta etapa. Perder/trocar
   a chave Fernet sem recifrar as sementes impede validar TOTP existente.
3. Conferir `docker compose config` sem imprimir o ambiente em tickets/logs.
   Backend e migrate recebem somente a allowlist; `POSTGRES_ADMIN_PASSWORD`,
   credenciais de backup e segredos de outros sistemas ficam fora. O usuário
   `moriah_app` deve ser dono do banco/schema, sem SUPERUSER/CREATEROLE/CREATEDB.
   Não alterar senha/role existentes automaticamente durante esta release.
4. No vhost exclusivo Moriah, conferir o overwrite de `X-Moriah-Client-IP`
   conforme `deploy/Caddyfile.moriah.example`; depois ligar `AUTH_TRUST_CLIENT_IP`.
   Backend/gateway devem permanecer acessíveis apenas pela cadeia de proxies
   confiáveis. Se houver CDN na frente, definir trusted_proxies no Caddy com os
   CIDRs reais antes de usar IP encaminhado; não confiar em XFF arbitrário.
5. Validar `check --deploy --tag security --fail-level WARNING`,
   `check_financial_isolation`, `migrate --plan`. Aplicar a migration accounts
   0005 explicitamente. Não há reescrita de lançamentos históricos.
6. Publicar backend **junto** com web/mobile compatíveis. Todos os JWT antigos
   sem `sid` deixam de funcionar; comunicar novo login obrigatório. Builds
   nativos antigos que não persistem o refresh rotativo precisam ser atualizados.
7. Ensaiar login comum, igreja suspensa, login com senha/WhatsApp de gestor,
   cadastro do autenticador, recuperação, logout e arquivo privado. Guardar os
   oito códigos de recuperação fora do aparelho; cada um funciona uma vez.
   O Django Admin exige fator já cadastrado pelo aplicativo. Não há variável de
   ambiente para desligar MFA em produção.
8. Rodar `npm run export:web`. A política CSP começa como Report-Only. Após QA
   real com a mesma build e revisão das violações, gerar o arquivo com
   `CSP_ENFORCE=true node scripts/web-security-headers.cjs` antes de construir
   a imagem web. Estilos inline são necessários pelo React Native Web; não se
   autoriza `unsafe-eval` nem scripts inline genéricos. Política atual admite
   mídia da mesma origem; storage S3/R2 precisa de origem explícita e novo QA.
9. Rollback: voltar o par de imagens anterior, preservar tabelas adicionadas,
   sem reverter migration em banco usado. O frontend anterior pode precisar
   de limpar credenciais e relogar. Rollback reintroduz riscos do modelo JWT
   anterior e requer decisão operacional; não tratar como correção equivalente.

MFA usa papéis adicionais também: staff/superuser ou qualquer papel operacional
além de member. Não depende de vínculo `Member`. Elevação de papel torna uma
sessão sem MFA inválida imediatamente. Alteração de senha, suspensão do usuário
ou da igreja invalidam sessões e links existentes. Expiração absoluta de sete
dias não é prolongada pelo refresh. Access padrão: dez minutos.

Limite inicial de senha: cinco tentativas por conta+IP e cinquenta por IP em
quinze minutos, compartilhado pelos workers e aliases, inclusive Admin. O
orçamento conta também tentativas bem-sucedidas para limitar trabalho de hash;
calibrar após observação, preservando proteção. Os identificadores são HMAC,
sem e-mails/IPs em claro. `prune_whatsapp_auth` também remove desafios/sessões
expirados e contadores antigos; manter o agendamento diário existente.

### Recuperação administrativa

Preferir códigos de recuperação. Se todos forem perdidos, operador autorizado
deve confirmar identidade fora do aplicativo e registrar chamado/justificativa.
`manage.py reset_mfa --user-id ID --confirm-email EMAIL --reason JUSTIFICATIVA`
remove o fator, invalida desafios e revoga todas as sessões, gerando AuditLog.
O próximo login exige senha/WhatsApp e **novo** cadastro MFA. O comando não
emite token, não cria conta e não concede privilégios. Não incluir segredos
ou dados pessoais desnecessários na justificativa. Limitar acesso SSH/exec
que permite executar esse comando.

## SSH, firewall e Monit na VPS compartilhada

Dependências reais: nome do operador, chave pública autorizada, CIDRs IPv4 e
IPv6 administrativos/VPN, acesso ao console independente do provedor, lista
dos serviços compartilhados e janela. Sem isso, a aplicação das regras pode
interromper outros sistemas ou bloquear acesso. Templates são propostas,
não scripts de aplicação automática.

1. Inventariar `ss -lntup`, regras IPv4/IPv6, portas publicadas Docker, networks,
   listeners SSH/Monit, configuração efetiva `sshd -T`, nginx/Caddy e serviços
   Nexor/Evolution/Simulador. Conferir firewall do provedor separadamente.
2. Criar operador nominal com sudo e chave, sem copiar chave privada. Testar
   login + sudo em segunda sessão, mantendo sessão atual e console do provedor.
3. Salvar configurações atuais em diretório root 700. Preparar restauração
   específica desses arquivos/regras e agendar rollback com `systemd-run
   --on-active=5m`; testar primeiro em VM descartável. Não usar flush global
   de iptables, não remover chains Docker e não ativar UFW sem plano de rotas.
4. Aplicar `deploy/ssh-hardening.conf.example` em arquivo que tenha precedência
   efetiva na distribuição. Validar `sshd -t` e `sshd -T`, fazer reload (não
   restart), testar novamente operador + sudo e só então encerrar acesso root.
5. Projetar regras de entrada permitindo established/related, loopback, SSH
   pelos CIDRs confirmados, HTTP/HTTPS públicos e portas necessárias dos
   demais serviços. Cobrir IPv6. Para portas publicadas Docker, verificar
   DOCKER-USER e o comportamento da versão de Docker instalada; regras INPUT
   sozinhas não bloqueiam DNAT Docker. Validar de origem externa e VPN.
6. Substituir o bloco HTTP Monit conforme exemplo, preservando credenciais
   privadas. Validar `monit -t`, recarregar e testar `127.0.0.1:2812` via túnel;
   de fora da VPS, 2812 deve deixar de responder. Fechar também no provedor.
7. Habilitar proteção contra brute force compatível com journald/SSH real;
   conferir filtros e whitelists da VPN. Não banir cegamente IP NAT de equipe.
8. Conferir todos os serviços compartilhados, DNS/HTTPS, login Moriah, backups,
   Docker e acesso administrativo. Cancelar rollback **apenas após os testes**.
   Rodar `scripts/check_host_security.sh` e guardar evidência sem credenciais.

## Backup cifrado fora da VPS

`scripts/backup_offsite.sh` usa restic, criptografa conteúdo/metadados e envia
somente o último par dump+mídia já validado pelo backup local. Não cria
repositório, não remove histórico e não envia notificações implicitamente.
Falha/atraso não atualiza `last-offsite-success`. Usar restic 0.19.1 validado
no ensaio local. Referências: [release](https://restic.net/),
[documentação](https://restic.readthedocs.io/en/stable/).

Antes de ativar: escolher destino/provedor/custo, conta restrita, retenção,
imutabilidade, responsáveis, custódia da senha e canal autorizado de alertas.
Guardar `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE` e credenciais remotas em
configuração privada do serviço de backup; não na allowlist do backend. Inicializar
repositório explicitamente. Agendar envio após backup local e vigia independente
com `check_backup_freshness.py` para o sucesso **local e externo** (26 horas).
Integrar o exit status ao canal aprovado. Sem vigia externo, perda total do host
também pode silenciar o alerta. Sem destino externo configurado o risco persiste.

Ensaio obrigatório: `restic check --read-data`, restaurar snapshot em diretório
novo, comparar checksums, restaurar dump em PostgreSQL descartável e mídia em
volume novo, validar contagens e acesso a anexos. Nunca usar volumes de produção
no ensaio. RPO proposto: 24h; medir RTO do ensaio antes de assumi-lo. Dump/mídia
são copiados sequencialmente; pausar escritas se exigir consistência estrita.
Retenção local de 30 dias preservada; política remota ainda depende da escolha.

## Dados do diretório

| Campos | Próprio perfil | Admin/pastor/secretaria | Tesouraria/coordenação |
|---|---|---|---|
| Nome, nome preferido, e-mail, telefone, status, célula, ministérios | Sim | Sim | Sim |
| Endereço, nascimento, estado civil, família, relações familiares, notas, ingresso | Sim | Sim | Não retornados |

Papéis adicionais acumulam permissões. Diretório segue limitado à igreja atual.
Telas operacionais usam nome/contato/status, preservados no contrato reduzido.
O acesso próprio e a visão já limitada de líderes de célula seguem seus contratos.
Secretaria administra cadastro; pastor/admin mantêm acesso pastoral. Revisar a
necessidade das notas da secretaria com o responsável de dados antes de ampliar
ou redefinir essa política.

## Limites das verificações

O guard offline de credenciais cobre arquivos de ambiente, chaves privadas e
alguns padrões de chave, sem enviar inventário. Não é scanner completo de CVEs
ou de todos os fornecedores. O `npm audit` foi autorizado e executado em
13/10/2026: 45 sinalizações iniciais foram reduzidas para 26 (zero críticas,
20 altas e 6 moderadas). As raízes restantes são braces, image-size,
node-forge e sprintf-js na cadeia de build Expo/React Native; atualizações
incompatíveis não foram forçadas. Detalhes em `npm-audit-2026-10-13.json`.
Não afirmar ausência total de vulnerabilidades.
