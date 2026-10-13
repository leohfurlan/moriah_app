# Auditoria de segurança do Moriah — 12/10/2026

## Parecer

**Risco geral alto, pela combinação de exposição administrativa da VPS, dependências sem suporte e falhas de controle de acesso/sessão.** Existem proteções importantes, mas não considero o ambiente suficientemente endurecido para expansão antes das correções prioritárias.

Não foi encontrado acesso HTTP direto aos arquivos de ambiente, nem correspondência dos segredos conhecidos no bundle web de produção ou nos objetos Git examinados. Isso não significa que as variáveis estejam inacessíveis a quem comprometer o processo backend: elas estão disponíveis ao processo e o container recebe inclusive a senha de superusuário do PostgreSQL, desnecessária para atender a API.

A revisão identificou vulnerabilidades e exposição; não realizou perícia para determinar se houve invasão anterior.

## Escopo e método

- Código local na revisão `f95d579`; backend e web em produção identificados como `f95d5798343f`.
- Aplicação pública: `https://app.igrejamoriah.com`; VPS `atos-pd`.
- Leitura de código Django/Expo, autenticação, permissões, serialização, uploads, mídia privada, Docker, proxy, backup e CI.
- Consultas SSH somente em leitura, com saídas restritas a configurações e metadados. Valores de segredos não foram impressos ou incluídos neste relatório.
- HTTP sem autenticação para rotas públicas e protegidas; sem força bruta em produção, sem exploração destrutiva e sem gravação de registros na aplicação em produção.
- Consultas de contagens PostgreSQL em transação `BEGIN READ ONLY`, encerrada com `ROLLBACK`.
- Reproduções de falhas exclusivamente com pessoas/igrejas fictícias em SQLite descartável.
- Nenhuma alteração de configuração, senha, firewall, serviço, banco ou release em produção. Nenhum commit ou deploy.

## Achados priorizados

| ID | Severidade | Achado | Evidência e condição |
|---|---|---|---|
| SEC-01 | Alta | SSH permite root e senha; entrada do host sem restrição observada | `sshd -T`: `permitrootlogin yes`, `passwordauthentication yes`; UFW inativo; `iptables -S INPUT`: política ACCEPT sem regras; fail2ban inativo. Não foi auditado o firewall externo da KingHost nem a existência de senha válida para root. |
| SEC-02 | Alta | Referências financeiras aceitam objetos de outra igreja | Reproduzido com JWT de tesouraria: POST da igreja A com `member` e `event` da B retornou 201 e os nomes estrangeiros. Exige conta com gestão financeira e IDs válidos. |
| SEC-03 | Alta | Backend recebe senha de superusuário do banco | `docker inspect` confirmou `POSTGRES_ADMIN_PASSWORD` no ambiente do backend; consulta somente leitura confirmou `moriah_admin` como superusuário. |
| SEC-04 | Alta | Django 5.1.10 em produção, série sem suporte | Versão confirmada no container e em `backend/requirements.txt`. Há correções de segurança posteriores e a série 5.1 encerrou suporte em 03/12/2025. |
| SEC-05 | Alta | Login por senha sem limitação de tentativas na aplicação | Classe efetiva de login em produção com `throttle_classes=[]`; 30 senhas erradas no teste isolado retornaram 401, nenhuma 429. Não há limitador no vhost Moriah examinado. |
| SEC-06 | Média | Token roubado não é revogado pelo logout ou troca de senha | Refresh de 7 dias, access de 60 minutos; sem rotação, blacklist ou `CHECK_REVOKE_TOKEN`. Teste isolado renovou sessão depois da troca de senha. |
| SEC-07 | Média | Painel Monit publicamente acessível em HTTP | Requisição externa à porta 2812 retornou 401. Há autenticação; configuração principal sem TLS nem bind em localhost, listener em `0.0.0.0:2812`. |
| SEC-08 | Média | Tokens persistem em AsyncStorage | Access e refresh gravados pelo app. Acesso ao armazenamento local ou execução de JavaScript na origem web pode expor os tokens. Não foi demonstrado um XSS. |
| SEC-09 | Média | Frontend sem cabeçalhos de proteção presentes no backend | GET `/` não apresentou CSP, HSTS, X-Frame-Options, nosniff ou Referrer-Policy. As respostas Django apresentaram HSTS, DENY e nosniff. |
| SEC-10 | Média | Igreja desativada continua conseguindo login por senha | Teste isolado com `Church.active=False` retornou access/refresh. O login WhatsApp verifica atividade da igreja; o login padrão por senha não aplica a mesma regra. |

### SEC-01 — Acesso administrativo ao host

A exposição do SSH amplia a possibilidade de ataques de credenciais e o impacto de comprometimento administrativo. Acesso root permite ler variáveis, arquivos, volumes, backups e configurações dos demais sistemas do host compartilhado.

**Correção:** criar/validar usuário administrativo por chave e acesso de recuperação; restringir SSH por VPN ou IP administrativo; desativar autenticação por senha e login direto de root; estabelecer firewall com política explícita e proteção contra tentativas repetidas. Validar regras Docker e serviços compartilhados antes da aplicação. Não ligar UFW ou fechar SSH às cegas.

### SEC-02 — Vazamento entre igrejas no financeiro

`FinancialEntrySerializer` expõe relações `member` e `event`, mas sua validação só trata o tipo de lançamento. O serializer resolve essas relações globalmente. `FinancialEntryViewSet.perform_create` fixa a igreja do lançamento, porém não valida a igreja dos objetos relacionados. A resposta serializa `member.full_name` e `event.name`.

**Referências:** `backend/apps/finance/serializers.py:114`, `backend/apps/finance/serializers.py:132`, `backend/apps/finance/views.py:209`, `backend/apps/finance/views.py:228`.

**Reprodução:** usuário de tesouraria da A, membro/evento da B, POST de uma despesa com os IDs estrangeiros → 201 e nomes da B. Não concede acesso geral ao banco nem à API de membros, mas permite descobrir existência/nomes e criar associação inválida. Atualizações compartilham o serializer e precisam receber a mesma proteção.

**Situação atual:** produção possui **uma igreja** e as duas consultas de inconsistência retornaram zero referências financeiras a membros/eventos de outra igreja. A vulnerabilidade é confirmada no código; não há evidência dessas associações inválidas no ambiente atual. O risco cresce quando houver outra igreja cadastrada.

**Correção:** restringir querysets das relações à igreja autenticada, validar coerência no serviço/modelo, cobrir POST e PATCH com testes entre igrejas e verificar referências já persistidas antes de futuras migrações.

### SEC-03 — Segredos além do necessário no backend

O bloco comum do Compose injeta `.env.pilot` inteiro no backend e no serviço de migração. Isso inclui `POSTGRES_ADMIN_PASSWORD`, além de chave Django, senha da aplicação e credenciais de integrações. O segredo administrativo deve pertencer à inicialização/administração do PostgreSQL.

**Referências:** `docker-compose.pilot.yml:18`, `docker-compose.pilot.yml:26`, `docker-compose.kinghost.yml:11`.

**Impacto:** se houver execução de código ou leitura arbitrária no processo backend, o invasor poderá obter todos os segredos entregues a ele. A senha administrativa permite aumentar o impacto no banco para além do usuário restrito da aplicação. Não foi demonstrada uma vulnerabilidade de execução remota nesta auditoria.

**Correção:** usar conjunto explícito de variáveis por serviço; remover a senha administrativa do backend/migração; separar credenciais e aplicar menor privilégio. Docker secrets/arquivos montados podem melhorar a distribuição, mas não tornam um segredo necessário ao processo inacessível ao próprio processo. Uma rotação deve ser planejada se houver indício de comprometimento, preservando dependências e disponibilidade.

### SEC-04 — Dependências

O Django confirma correções posteriores para injeção em logs (CVE-2025-48432), SQL injection em usos específicos de `FilteredRelation`/aliases (CVE-2025-57833 e CVE-2025-13372) e outras questões. A presença da versão afetada é confirmada; não foi identificado no código revisado um caminho que receba aliases arbitrários do cliente, nem demonstrada exploração desses CVEs. Não é correto equiparar versão vulnerável a invasão confirmada.

**Correção:** migrar para o patch vigente de uma série suportada, preferencialmente a LTS 5.2 conforme compatibilidade do projeto, com testes de permissões, uploads, mídia privada, autenticação, banco e implantação. Atualizar DRF/SimpleJWT e dependências transitivas após avaliar seus advisories; não atualizar apenas para 5.1.15, pois a série permanece sem suporte.

Fontes oficiais consultadas em 12/10/2026: [suporte das versões Django](https://www.djangoproject.com/download/), [5.1.11](https://docs.djangoproject.com/en/5.1/releases/5.1.11/), [5.1.12](https://docs.djangoproject.com/en/5.1/releases/5.1.12/), [5.1.15](https://docs.djangoproject.com/en/5.1/releases/5.1.15/).

### SEC-05 e SEC-06 — Login e sessões

O login usa `TokenObtainPairView` diretamente e não define controle de força bruta. Os limites implementados para WhatsApp não protegem o login por senha. Os aliases `/api/`, `/backend/` e `/local-api/` precisam compartilhar os mesmos limites para evitar bypass por prefixo.

O logout do app apenas apaga o armazenamento local. Um refresh previamente copiado permanece utilizável por até sete dias; a troca de senha também não impede sua renovação nas configurações atuais. Desativação de usuário é um controle distinto e não deve ser confundida com revogação de sessão individual.

**Referências:** `backend/config/urls.py:86`, `backend/config/urls.py:132`, `backend/config/settings.py:117`, `backend/config/settings.py:141`, `mobile/src/hooks/useAuth.ts:111`.

**Correção:** proteção contra abuso por conta/IP, compartilhada entre workers e aliases; MFA para contas administrativas; access mais curto; refresh rotativo com revogação; logout no servidor e revogação após troca de senha. Coordenar alterações do refresh com o cliente, que atualmente armazena somente o novo access na renovação.

O DRF adverte que seu throttling isolado não é proteção suficiente contra força bruta/DDoS: [documentação oficial](https://www.django-rest-framework.org/api-guide/throttling/). São necessários controles adequados na aplicação e na borda.

### SEC-07 — Monit

A porta 2812 foi comprovadamente acessível a partir da máquina de auditoria, em HTTP, sem credenciais, recebendo 401. Isso comprova exposição e exigência de autenticação, **não acesso administrativo sem senha**. Utilizar autenticação nesse endereço sem TLS expõe o tráfego administrativo à interceptação.

**Correção:** bind em localhost e acesso por túnel/VPN, ou proxy HTTPS com controle de origem e autenticação forte. Verificar os demais usos desse painel antes de restringir o host compartilhado.

### SEC-08 e SEC-09 — Cliente web/mobile

`mobile/src/services/storage.ts:1` usa AsyncStorage para os dois tokens. No aplicativo nativo, migrar segredos de sessão para armazenamento seguro da plataforma. No web, avaliar refresh em cookie HttpOnly/Secure/SameSite com defesa CSRF correspondente e access em memória, conforme a arquitetura escolhida.

A resposta HTML estática passa pelo Nginx, sem os cabeçalhos adicionados pelo Django. Proteger também HTML e assets com uma política apropriada; construir a CSP a partir dos recursos realmente necessários ao Expo e evitar uma política incompatível com o app.

**Referência:** `deploy/nginx-web.conf:20`. A ausência de CSP é uma lacuna de defesa; não comprova XSS. O renderizador Markdown examinado usa componentes Text e não injeta HTML arbitrário.

### SEC-10 — Atividade da igreja

Uniformizar a checagem de igreja ativa no login, refresh e autorização das requisições, incluindo sessões já emitidas e mídia privada. Se `active` não representar suspensão de acesso, documentar essa semântica explicitamente; atualmente os fluxos de senha e WhatsApp têm comportamentos diferentes.

## Variáveis de ambiente e vazamento de informações

| Verificação | Resultado |
|---|---|
| `.env` e `.env.pilot` versionados atualmente | Não; apenas exemplos estão rastreados. |
| Histórico Git disponível | 82 commits acessíveis; 1.016 blobs examinados, sem correspondências dos valores sensíveis locais conhecidos nem dos padrões de chave privada/AWS access key/GitHub token pesquisados. Não abrange refs remotas não obtidas, objetos inacessíveis ou outros tipos de segredo. |
| Arquivos atuais/bundle local disponível | 426 arquivos examinados, sem as correspondências pesquisadas. |
| Bundle web em produção | Arquivo tar lido em memória, 3.233.280 bytes, comando concluído com sucesso. Nenhum valor sensível conhecido do ambiente do backend encontrado. Valores não foram impressos. |
| GET `/.env`, `/.env.pilot`, `/.git/config` | 200 com o mesmo hash/HTML de `/`, pelo fallback da SPA; não são os arquivos solicitados e não constituem vazamento confirmado. Recomenda-se responder 404 explicitamente para dotfiles. |
| GET `/backend/.env` | 404. |
| Permissão de `/opt/moriah_app/.env.pilot` | `600 root:root`; diretório da aplicação `750 root:root`. |
| Ambiente sensível no container web | Nenhuma variável sensível identificada na inspeção. |
| `EXPO_PUBLIC_*` no código examinado | Apenas a URL da API. É informação pública; não deve receber chaves ou senhas. |
| Configuração efetiva Django | DEBUG false, chave não reconhecida como insegura pelo check do projeto, hosts exatos e CORS/CSRF restritos ao domínio HTTPS. |

Qualquer variável `EXPO_PUBLIC_*` referenciada é incorporada ao cliente; chamá-la de variável de ambiente não a torna secreta. Fonte: [Expo — environment variables](https://docs.expo.dev/guides/environment-variables/).

O `.dockerignore` do backend exclui ambientes/arquivos locais; o build web copia somente o export estático. Essas proteções reduzem publicação acidental. Um comprometimento do host/root/Docker ou do processo que usa os segredos continua permitindo sua leitura. `chmod 600` e `.gitignore` não protegem contra esses cenários.

## Controles existentes confirmados

- Autenticação JWT exigida por padrão na API; requisições anônimas de produção a `/backend/me/`, `/backend/members/` e `/backend/finance/entries/` retornaram 401.
- Banco sem porta publicada e backend ligado somente a `127.0.0.1:18020`; gateway web na rede de borda e backend na rede da aplicação.
- Backend roda como usuário `app`, web como UID 101; containers inspecionados sem modo privilegiado e sem montagem do socket Docker.
- Mídia local privada ativada; `/media/` retorna 404; download sem assinatura retorna 404. Links temporários reavaliam usuário e permissão e devolvem `private, no-store`.
- Testes de comprovantes verificam outro membro, outra igreja, assinatura alterada/expirada e revogação. Não foi testada uma política real de bucket S3, pois produção utiliza volume local privado.
- Código OTP com HMAC, comparação constante, expiração, limite de cinco tentativas, consumo único e limites compartilhados de envio por banco; chamadas ao provedor ocultam corpo, chave, telefone e código em erros. Concorrência PostgreSQL não foi reexecutada nesta auditoria.
- Uploads limitam tamanho e extensão e verificam assinatura inicial. Isso não equivale a antivírus ou validação completa de PDF/imagem; não foi demonstrada execução de arquivos enviados.
- Logs de acesso internos de Gunicorn/Nginx omitem query strings para reduzir vazamento de URLs assinadas. A cadeia completa de retenção/observabilidade não foi auditada.
- `manage.py check --deploy --tag security --fail-level WARNING` passou em produção. Esse check não detecta todos os achados deste relatório.

## Backup, minimização e endurecimentos adicionais

O timer de backup está ativo. A leitura encontrou 16 dumps e último sucesso em `2026-10-12T05:00:05Z`; `/var/backups/moriah` está com permissão 700. O script aplica umask 077, valida arquivos e mantém retenção de 30 dias.

O fluxo documentado e implementado guarda banco e mídia na própria VPS, sem criptografia explícita dos arquivos nem cópia externa no script. Não foi auditada a criptografia de disco do provedor ou eventual serviço externo de backup. Comprometer/perder o host pode atingir dados e cópias juntos. Recomenda-se cópia externa criptografada, credencial separada e restauração periódica em ambiente isolado. Não foi realizado novo restore nesta auditoria.

O diretório administrativo de membros retorna endereço, nascimento, estado civil, notas e relações familiares a vários papéis de gestão, inclusive coordenação/tesouraria. Isso está explícito nas permissões atuais; não foi classificado como bypass. Revisar a necessidade de cada campo por papel reduz exposição em caso de conta comprometida. `backend/apps/members/serializers.py:23`, `backend/apps/accounts/permissions.py:140`.

O backend permite iniciar com chave de exemplo e emite warning; a barreira forte está em `check --deploy`. A produção atual passou no check, mas convém falhar na inicialização se a chave estiver ausente/insegura para reduzir dependência do procedimento de deploy. `backend/config/settings.py:13`, `backend/config/settings.py:213`.

## Validação e evidências locais

- Suíte existente com Python 3.12: **318 passed, 7 skipped**. Os sete testes dependem de PostgreSQL/locks e não foram reexecutados.
- Quatro testes específicos da auditoria: **4 passed**. Eles afirmam os comportamentos inseguros observados; seu sucesso confirma a reprodução, não a segurança do sistema.
- Artefatos locais ignorados pelo Git: `tmp/security-audit-2026-10-12/test_security_probes.py`, `security-probes.txt` e `backend-suite-python312.txt`.
- O primeiro teste com Python 3.14 sofreu restrição de diretório temporário e incompatibilidade de renderização Django/Python; a execução final usou o Python 3.12 fornecido pelo runtime, dependências Python disponíveis e temporário no workspace. Não foi necessário editar o código da aplicação.
- A revisão automática bloqueou `npm audit`: o comando enviaria nomes/versões de dependências ao registro público npm sem autorização explícita para esse payload/destino. A tentativa comum também falhou na resolução DNS. Autorização solicitada; consulta não concluída até a emissão deste relatório. Nenhuma conclusão de ausência de CVEs npm é feita.
- Não houve varredura completa de CVEs de todos os pacotes Python/transitivos, imagens de base ou sistema operacional. O achado Django foi confirmado por versão instalada e fontes oficiais.

## Ordem recomendada de correção

1. Fechar a exposição administrativa desnecessária do Monit e endurecer SSH/firewall, preservando acesso e serviços existentes.
2. Retirar a senha administrativa do PostgreSQL do backend e separar os segredos por serviço.
3. Corrigir referências financeiras entre igrejas, cobrindo criação e atualização.
4. Atualizar Django para série suportada e completar a revisão das demais dependências.
5. Proteger login por senha, adicionar MFA administrativo e implementar revogação/rotação de sessões em conjunto com o cliente.
6. Aplicar proteção de armazenamento de tokens e cabeçalhos no frontend; uniformizar suspensão da igreja.
7. Adicionar backup externo criptografado e revisar campos pessoais por papel.

As correções que alteram acesso SSH, firewall, proxy, credenciais e sessões precisam de validação coordenada; este relatório não aplica essas mudanças.
