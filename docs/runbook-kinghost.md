# Moriah — operação na VPS KingHost

Decisão confirmada em 08/10/2026: `app.igrejamoriah.com`, banco PostgreSQL
exclusivo e arquivos privados persistidos na VPS `atos-pd`. Esta decisão
substitui Neon/S3/R2 para esta implantação. O site raiz continua separado.
O usuário autorizou desenvolvimento e deploy; não é necessário reaprová-los.

## Stack

Projeto `moriah-piloto`, diretório `/opt/moriah_app`:

- `backend`: Gunicorn, 2 workers, 1 CPU/768 MiB, porta diagnóstica
  `127.0.0.1:18020`; sem exposição direta à internet.
- `web`: bundle Expo e gateway Nginx, 0,25 CPU/128 MiB.
- `db`: PostgreSQL 16, 0,5 CPU/512 MiB, volume `postgres_data`, sem porta
  publicada. Usuário administrativo e aplicação têm senhas distintas;
  `moriah_app` é dono apenas do banco `moriah` e não é superuser.
- `media_data`: volume em `/app/media`, dono UID 10001. Não remover volumes
  durante deploy ou rollback.
- `migrate`: ferramenta explícita; reiniciar serviços não aplica migrations.
- Rede externa `moriah_piloto_edge`: liga somente web ao Caddy existente.
  Banco e backend ficam na rede privada do projeto Moriah.

## Arquivos privados

`PRIVATE_LOCAL_MEDIA=true` habilita URLs assinadas de 15 minutos para um
arquivo específico. O endpoint verifica igreja, proprietário/papel atual e
usuário ativo a cada acesso. Comprovantes usam download como anexo; imagens
de avisos usam leitura inline. `/media/` não é servido pelo gateway. Tanto o
app quanto os links do Django Admin usam o endpoint protegido.

`LOCAL_MEDIA_PERSISTENT=true` só passa o check de deploy se `MEDIA_ROOT`
for realmente um ponto de montagem. Tokens de download e JWT não entram no
formato de access log do gateway/Gunicorn.

## Release e deploy

1. Fechar commit validado; `APP_REVISION` deve ser o SHA nas duas imagens.
2. Exportar web com `EXPO_PUBLIC_API_URL=/backend`; construir backend e web
   localmente, exportar imagens e verificar SHA256 após transferência.
3. Na primeira configuração, copiar `deploy/kinghost.env.example` para
   `.env.pilot`, preencher segredos aleatórios, `chmod 600`; nunca copiar env
   de desenvolvimento nem enviar segredos à conversa.
4. Criar a rede `moriah_piloto_edge`. Persistir a associação dessa rede no
   Compose que administra o proxy existente; conectá-lo à rede sem reinício.
5. Carregar imagens na VPS; conferir labels da revisão.
6. Verificar backup ou confirmar que o primeiro banco está vazio.
7. Executar `MORIAH_BACKUP_VERIFIED=yes bash scripts/deploy_kinghost.sh <SHA>`.
8. Validar o bloco Caddy de `app.igrejamoriah.com`, upstream
   `moriah-piloto-web:8080`; fazer reload somente após `caddy validate`.
9. Criar administrador exclusivo da Igreja Moriah, sem `seed_mvp` no ambiente
   público. Sincronizar permissões, conferir HTTPS, login e admin.

O script reprova placeholders, revisão incorreta da imagem e warnings de
segurança; aplica migrations e permissões; verifica readiness/revisão; grava
o SHA em `.env.pilot` somente após inicialização bem-sucedida.

## Backup

`bash scripts/backup_kinghost.sh` gera database dump e archive de `media`,
valida ambos e grava checksums. Destino padrão `/var/backups/moriah`, acesso
restrito, retenção de 30 dias. `moriah-backup.timer` roda diariamente às 02:00
no fuso America/Sao_Paulo; logs em `journalctl -u moriah-backup.service`.

O backup local recupera erro lógico ou redeploy, mas não cobre perda da VPS
e do disco. A decisão atual mantém tudo na KingHost; cópia externa permanece
uma evolução pendente. Para snapshot rigorosamente consistente de banco e
arquivos, pausar escrita antes de executar o backup.

Ensaio de restauração: subir Postgres descartável sem porta pública, restaurar
o dump com `pg_restore --exit-on-error`, conferir tabelas/contagens e restaurar
o tar em volume descartável. Jamais apontar o ensaio para o volume principal.

## Boot e rollback

`deploy/moriah-kinghost.service` gerencia apenas db/backend/web do Moriah e
não toca no proxy compartilhado. Docker também usa `unless-stopped`.

Rollback: manter imagens anteriores, exportar `APP_REVISION=<SHA anterior>`
e executar Compose com `up -d --no-build backend web`; após verificação,
persistir o SHA anterior no env. Não reverter banco automaticamente. No
primeiro deploy, retirar somente a rota Moriah e parar os seus serviços se
necessário, preservando os volumes.

## Checagens após publicação

- HTTPS válido, `/health/` com SHA esperado, `/health/ready/` acessível;
- login, refresh, logout e isolamento por igreja;
- app em desktop/celular, rotas diretas, estáticos do admin;
- comprovante privado acessível por link temporário e rejeitado sem assinatura;
- arquivo preservado após recriar backend/web;
- Nexor/Evolution/Simulador seguem disponíveis;
- backup, timer e restauração documentados;
- registro `app` aponta à VPS; não presumir que DNS da raiz configura o subdomínio.
