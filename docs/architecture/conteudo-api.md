# Conteúdo — primeira fatia vertical da Fase 6

Data: 17/09/2026. Texto simples, título (até 255 caracteres), resumo opcional
(até 500) e corpo obrigatório (até 50.000). Sem anexos, mídia ou HTML executável.

## Acesso

Todas as operações exigem JWT e igreja associada à conta. Membros com vínculo
na mesma igreja recebem `read_content` e leem apenas publicações dessa igreja.
Administradores, superusuários e pastores recebem `read_content` e `manage_content`:
podem consultar rascunhos e publicações e operar o fluxo, mesmo sem vínculo de membro.
Papéis adicionais seguem a mesma regra. Um identificador de outra igreja retorna 404.
Usuários sem igreja não recebem essas capacidades nem acessam os endpoints.

## API

| Método | Endpoint | Comportamento |
|---|---|---|
| GET | `/api/content/?page=1&page_size=25` | Lista paginada conforme permissão; limite 100 por página |
| GET | `/api/content/{id}/` | Detalhe; rascunho invisível ao leitor retorna 404 |
| POST | `/api/content/` | Cria rascunho com título, resumo e corpo |
| PATCH | `/api/content/{id}/` | Edita somente rascunho |
| POST | `/api/content/{id}/publish/` | Publica explicitamente; repetição idempotente |
| POST | `/api/content/{id}/unpublish/` | Retira do ar e volta a rascunho; repetição idempotente |

Sem parâmetros de paginação, GET mantém o padrão existente de lista simples.
Aliases locais `/backend/content/` e `/local-api/content/` usam o mesmo ViewSet.
Resposta do item: `id`, `title`, `summary`, `body`, `status`, `published_at`,
`created_at`, `updated_at`. Igreja e autor são definidos pelo servidor;
status e datas não são graváveis pelo payload de criação/edição.

400 indica validação; 401 sessão inválida; 403 capacidade insuficiente;
404 objeto ausente/invisível; 409 tentativa de edição de uma publicação.
Publicado precisa ser retirado do ar antes da edição, evitando alteração silenciosa.
Não há exclusão física nesta fatia.

Criação, edição, publicação e retirada geram `AuditLog` na mesma transação.
Mutações de item bloqueiam a linha no PostgreSQL para serializar edição e publicação.
Falha da auditoria reverte a mudança. Publicação concorrente não duplica o registro.

## Interface e aceite

Lista `/content` e detalhe `/content/{id}` funcionam no desktop e mobile web.
Leitores não recebem controles de escrita. Publicadores têm formulário de rascunho,
publicação e retirada do ar. Falha ao salvar preserva os campos e permite nova tentativa;
falha de leitura oferece retry sem fingir lista vazia. Paginação, loading, vazio,
403, 404, 422 de validação simulada, 5xx e 401 com refresh recusado têm QA específico.
O backend usa 400 para validação, conforme DRF; o cliente trata também 422.
Reload consulta o servidor. Texto é renderizado como texto, nunca como HTML.

Migration `content/0001_initial.py` foi gerada e validada nos bancos de teste.
Em 17/09/2026, após autorização, `content/0001_initial` foi aplicada ao banco local
e os containers foram recriados; o build web foi publicado no preview ngrok.
Isso não constitui deploy em homologação ou produção externa.
Esta entrega conclui a fatia de Conteúdo; os outros domínios da Fase 6 permanecem futuros.
