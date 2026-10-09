# Plano de arquitetura e implementação — piloto Moriah com Oracle VPS + Neon

> Atualização de 08/10/2026: a recomendação de host e a sequência de implantação
> estão no [plano KingHost](../plano-implantacao-kinghost-2026-10-08.md), baseado
> na inspeção da VPS existente `atos-pd`. Este documento preserva a proposta
> original; não aplicar seu provisionamento Oracle ao host compartilhado.

**Data:** 18/09/2026  
**Status:** proposto; não autoriza provisionamento, deploy, migração de dados ou publicação  
**Escopo:** ambiente persistente de homologação/piloto interno do Moriah App

## 1. Decisão arquitetural

Para o piloto, a aplicação será executada em uma VPS da Oracle Cloud e o
PostgreSQL será consumido como serviço gerenciado no Neon.

```text
App Expo / navegador
        |
        | HTTPS 443
        v
Oracle VPS
  Caddy ou Nginx
  Django + servidor WSGI/ASGI
  tarefas administrativas e logs
        |
        | PostgreSQL sobre TLS, saída TCP 5432
        v
Neon PostgreSQL

Comprovantes -> S3/R2 privado
Backups      -> Neon branch de restauração + storage externo
DNS          -> homologacao.moriah.app
```

O Postgres não será instalado na VPS. A VPS também não executará o Expo em
modo desenvolvimento. O app mobile será distribuído por EAS e apontará para a
URL HTTPS do ambiente piloto.

## 2. Objetivos e não objetivos

### Objetivos

- obter um ambiente persistente, acessível fora da máquina de desenvolvimento;
- manter o banco fora da VPS e reduzir a operação local de banco;
- preservar o contrato atual do Django e do app mobile;
- armazenar comprovantes fora do disco efêmero da aplicação;
- testar deploy, migração, backup, restauração, HTTPS e operação com usuários
  controlados;
- permitir rollback para a última revisão implantada.

### Fora do escopo desta mudança

- alta disponibilidade da aplicação;
- Kubernetes, múltiplas VPS ou autoscaling;
- fila Redis/Celery, enquanto não existir uma necessidade funcional real;
- publicação em lojas;
- dados de produção da igreja sem aprovação específica;
- migração automática do banco local para o Neon;
- substituição das regras de negócio ou mudança no modelo funcional do MVP.

## 3. Princípios de implementação

1. O ambiente piloto será separado do desenvolvimento por configuração,
   banco, credenciais e domínio.
2. O deploy sempre partirá de uma revisão limpa e identificável por commit ou
   tag; nunca do working tree local.
3. Migrações serão uma etapa explícita do deploy, não um efeito colateral de
   cada reinício do container.
4. O seed de demonstração não será executado automaticamente no piloto.
5. Nenhuma porta de banco será publicada na internet.
6. O armazenamento de comprovantes será privado e externo à VPS.
7. Cada integração externa terá uma interface pequena e uma implementação
   substituível, permitindo testar localmente sem depender do Neon ou do S3/R2.

## 4. Interfaces e módulos envolvidos

### 4.1 Configuração de banco — seam `Django DATABASES`

**Interface:** o Django recebe nome, usuário, senha, host, porta, modo TLS e
tempo de vida das conexões por variáveis de ambiente.

**Implementação piloto:** PostgreSQL gerenciado pelo Neon.

**Implementação local:** PostgreSQL do Compose, preservado para desenvolvimento.

Alterações planejadas:

- manter `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_HOST` e `POSTGRES_PORT` para reduzir quebra de contrato;
- adicionar `POSTGRES_SSLMODE`, com `require` no piloto;
- adicionar configuração explícita de `CONN_MAX_AGE`;
- documentar quando usar endpoint direto e quando usar endpoint `-pooler`;
- validar falha de conexão e reconexão sem expor senha nos logs;
- manter testes usando a configuração SQLite isolada existente.

Para o piloto inicial, usar conexão direta com poucos workers. O endpoint
pooler do Neon será habilitado se a quantidade de workers ou conexões justificar
isso; a troca deve ocorrer apenas na configuração, sem alterar os consumidores
do banco.

### 4.2 Arquivos — seam `Django STORAGES`

**Interface:** o domínio de contribuições continua usando `FileField` e URLs
temporárias geradas pelo Django.

**Implementação local:** filesystem em `backend/media/`.

**Implementação piloto:** S3 ou Cloudflare R2 privado, com URLs assinadas e
expiração curta.

Alterações planejadas:

- ativar `USE_S3_STORAGE=true` somente no ambiente piloto;
- configurar bucket, região, endpoint e credenciais fora do repositório;
- validar upload, download autorizado, expiração e rejeição de acesso anônimo;
- executar teste de redeploy confirmando que o comprovante continua disponível.

### 4.3 Runtime web — seam `container de aplicação`

**Interface:** container HTTP que expõe Django em `127.0.0.1:8000` dentro da
rede do Compose.

**Implementação piloto:** servidor WSGI/ASGI de produção atrás de Caddy ou
Nginx.

Alterações planejadas:

- adicionar Gunicorn ou servidor ASGI compatível ao runtime escolhido;
- criar `docker-compose.pilot.yml`, sem o serviço `db` e sem o serviço `mobile`;
- remover bind mounts de código em produção;
- executar `collectstatic` como etapa controlada;
- executar `migrate` como etapa explícita e auditável;
- aplicar rotação de logs do Docker;
- adicionar endpoint público de liveness e, se necessário, verificação interna
  de banco sem revelar detalhes da conexão.

### 4.4 Backup e restauração — seam `scripts de operação`

O backup existente continuará usando `pg_dump` em formato custom, mas será
parametrizado para o endpoint do Neon e TLS.

O restore não deve presumir que existe um segundo banco local com permissão
administrativa. O procedimento piloto será:

1. criar uma branch descartável do Neon em um ponto de tempo definido;
2. restaurar o dump nessa branch ou validar a recuperação fornecida pelo Neon;
3. aplicar migrações/checagens necessárias;
4. conferir contagens e fluxos mínimos;
5. descartar a branch somente após registrar a evidência.

O backup também deverá ser copiado para storage externo à VPS. Um backup que
permanece apenas no disco da Oracle não atende ao objetivo de recuperação após
perda da máquina.

## 5. Topologia e segurança da Oracle VPS

### Entrada

- TCP 443: público, para aplicação e admin;
- TCP 80: público apenas para redirecionamento e desafio inicial de certificado;
- TCP 22: restrito ao IP administrativo, quando possível;
- TCP 5432: fechado na VPS.

### Saída

- HTTPS para repositório, EAS e serviços auxiliares necessários;
- TCP 5432 para o endpoint do Neon, protegido por TLS;
- HTTPS para S3/R2;
- DNS apontando para IP público reservado da VPS.

As regras devem ser aplicadas na VCN/NSG ou security list da OCI e também no
firewall do sistema operacional. A OCI recomenda controlar as regras de rede
no nível apropriado e lembra que as regras da rede e do firewall da imagem
podem atuar simultaneamente.

### Segredos

Não versionar:

- senha e endpoint completo do Neon;
- `DJANGO_SECRET_KEY`;
- credenciais S3/R2;
- tokens de deploy ou de monitoramento.

O arquivo `.env` do piloto ficará somente na VPS, com permissões restritas.
Como evolução, os segredos poderão ser movidos para um gerenciador dedicado.

## 6. Ambientes e dados

Serão mantidos três contextos distintos:

| Contexto | Aplicação | Banco | Dados |
|---|---|---|---|
| Desenvolvimento | Compose local | Postgres local | seed e dados descartáveis |
| Homologação/piloto | Oracle VPS | branch Neon própria | dados controlados |
| Futuro produção | ainda não definido | branch/projeto protegido | dados reais aprovados |

O piloto não deve usar a branch principal do Neon que contenha dados de
produção. A branch e as credenciais do piloto devem ter nomes próprios e serem
revogáveis.

## 7. Plano de execução por fases

### Fase 0 — baseline e decisões

- confirmar revisão de código que será a base do piloto;
- concluir ou registrar pendências de QA visual e dispositivos;
- confirmar domínio e região da VPS/Neon;
- escolher S3 ou R2;
- definir lista de usuários, dados de teste, janela e responsável pelo piloto;
- registrar política de rollback.

**Saída:** decisão aprovada e commit-base identificado.

### Fase 1 — adaptação local do runtime

- implementar configuração de banco com TLS;
- criar compose específico de piloto;
- substituir `runserver` por runtime de produção;
- separar migração, seed e inicialização;
- adicionar health check;
- configurar storage externo por ambiente;
- atualizar `.env.example` sem inserir segredos;
- adicionar testes de configuração e regressão.

**Saída:** stack de piloto sobe localmente sem Postgres local e sem Expo
dev-server.

### Fase 2 — provisionamento da Oracle

- criar VM e IP público reservado;
- aplicar VCN/NSG, firewall do sistema e acesso SSH;
- instalar Docker e ferramentas de operação;
- criar usuário de deploy sem operar a aplicação como root;
- configurar domínio e certificado HTTPS;
- instalar rotação de logs e monitoramento básico.

**Saída:** VPS acessível por HTTPS e SSH restrito, sem porta 5432 pública.

### Fase 3 — preparação do Neon e storage

- criar projeto/branch exclusiva do piloto;
- criar credencial específica da aplicação;
- testar conexão TLS a partir da VPS;
- configurar política de escala, limite de conexões e alerta de custo;
- criar bucket privado de comprovantes;
- validar URLs assinadas;
- executar primeiro backup e registrar o resultado.

**Saída:** banco e arquivos persistentes disponíveis sem depender do disco da
VPS.

### Fase 4 — primeiro deploy controlado

- publicar a revisão-base por tag ou commit;
- executar migrações explicitamente;
- criar usuário administrativo de piloto;
- sincronizar permissões;
- carregar somente dados de teste aprovados;
- validar `/health/`, login, admin, fluxo financeiro, escalas e anexos;
- registrar logs, tempos de resposta e falhas.

**Saída:** ambiente piloto acessível, ainda sem usuários finais.

### Fase 5 — backup, restauração e rollback

- executar backup agendado;
- verificar integridade do arquivo com `pg_restore --list`;
- restaurar ou validar recuperação em branch descartável;
- testar rollback da aplicação para a revisão anterior;
- simular indisponibilidade do Neon e confirmar mensagem/recuperação;
- documentar os comandos e evidências.

**Saída:** recuperação comprovada, não apenas backup criado.

### Fase 6 — piloto interno

- iniciar com grupo pequeno e dados controlados;
- acompanhar autenticação, contribuições, comprovantes, escalas e admin;
- registrar incidentes com horário, usuário de teste e request/correlation ID;
- não executar operações irreversíveis sem confirmação;
- revisar custos, latência e capacidade ao final da primeira semana;
- decidir expansão, correção ou rollback.

**Saída:** relatório do piloto com evidências e decisão de próxima etapa.

## 8. Critérios de aceite

### Infraestrutura

- [ ] DNS resolve para o IP correto;
- [ ] HTTPS válido e redirecionamento HTTP funcionando;
- [ ] SSH restrito e sem login operacional como root;
- [ ] portas abertas documentadas;
- [ ] 5432 não está exposta na VPS;
- [ ] logs têm retenção/rotação;
- [ ] health check responde sem vazar segredos.

### Aplicação

- [ ] `manage.py check --deploy` passa no ambiente piloto;
- [ ] `DJANGO_DEBUG=false`;
- [ ] `DJANGO_SECRET_KEY` não é a chave de desenvolvimento;
- [ ] hosts, CORS e CSRF aceitam somente os domínios necessários;
- [ ] migrações executadas na branch correta do Neon;
- [ ] seed não roda em cada reinício;
- [ ] mobile preview acessa a URL HTTPS real;
- [ ] admin e fluxo principal funcionam fora da rede local.

### Dados e recuperação

- [ ] comprovante é salvo no S3/R2 privado;
- [ ] link de comprovante é temporário e autorizado;
- [ ] backup é produzido e validado;
- [ ] restauração foi testada em recurso descartável;
- [ ] rollback da aplicação foi executado com sucesso;
- [ ] nenhum dado de produção foi misturado ao piloto.

## 9. Observabilidade mínima

No primeiro piloto, não é necessário introduzir uma plataforma completa de
observabilidade. Devem existir, no mínimo:

- health check monitorado externamente;
- logs do proxy e Django com timestamp;
- status HTTP, latência e erros 5xx acompanhados;
- alerta de falha de backup;
- métricas de custo/uso do Neon;
- identificação do commit implantado;
- relatório de incidentes do piloto.

## 10. Rollback

### Rollback de aplicação

1. parar o tráfego ou colocar manutenção curta;
2. voltar para a imagem/commit anterior;
3. reiniciar o runtime;
4. verificar health check, login e leitura de dados;
5. não desfazer migração automaticamente.

### Rollback de banco

Migrações destrutivas não serão permitidas no piloto sem plano de recuperação.
Quando houver mudança incompatível, a estratégia será expandir o schema,
implantar código compatível, migrar dados e só depois remover estruturas
antigas.

## 11. Entregáveis esperados

- `docker-compose.pilot.yml`;
- configuração de banco Neon documentada;
- configuração de storage S3/R2 documentada;
- runbook de deploy e rollback;
- runbook de backup e restauração;
- health check e checagens de deploy;
- atualização de `.env.example`;
- testes de regressão;
- evidências do primeiro deploy e restauração;
- relatório do piloto.

## 12. Ordem recomendada de implementação

1. Fechar a revisão-base e o escopo do piloto.
2. Adaptar configuração, compose e runtime localmente.
3. Validar localmente sem modificar produção.
4. Provisionar a VPS Oracle.
5. Criar Neon e storage do piloto.
6. Fazer deploy controlado.
7. Testar backup, restore e rollback.
8. Iniciar o grupo reduzido de usuários.

Nenhuma etapa deste documento implica commit, push, provisionamento, migração
ou deploy automático. Essas ações serão executadas somente quando autorizadas
separadamente.

## Referências técnicas

- [Neon — connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon — compute, conexões e scale-to-zero](https://neon.com/docs/manage/endpoints/)
- [Neon — branches isoladas](https://neon.com/docs/get-started-with-neon/workflow-primer)
- [Oracle OCI — formas de proteger a rede](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/waystosecure.htm)
