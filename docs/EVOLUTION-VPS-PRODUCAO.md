# Evolution API na VPS — MaterPlace

## Arquitetura

A Evolution API não roda na Vercel. A VPS mantém Docker, PostgreSQL, Redis e a sessão persistente do WhatsApp. O navegador chama apenas `/api/evolution/*` na Vercel. Essas funções validam o usuário no Supabase, verificam sua organização e chamam a VPS usando a chave secreta.

## Requisitos

- VPS Ubuntu 24.04 com 2 vCPU, 4 GB de RAM e IP público;
- domínio `whatsapp.materplace.com.br` apontado para a VPS;
- Docker Engine e Docker Compose;
- proxy HTTPS (Caddy ou Nginx) encaminhando para `127.0.0.1:8080`;
- portas públicas 80 e 443. A porta 8080 deve permanecer restrita ao localhost.

## Instalação

1. Copie `infra/evolution` para `/opt/materplace-evolution` na VPS.
2. Copie `.env.example` para `.env` e troque todas as senhas/chaves.
3. Use uma chave aleatória de pelo menos 64 caracteres em `AUTHENTICATION_API_KEY`.
4. Execute `docker compose pull` e `docker compose up -d`.
5. Confirme com `docker compose ps` e `docker compose logs -f evolution-api`.
6. Configure o proxy HTTPS para `http://127.0.0.1:8080`.
7. Na Vercel, cadastre `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `PUBLIC_APP_URL`.

## Webhooks

Ao criar uma instância, a API da MaterPlace configura um webhook individual contendo o ID e um segredo aleatório. O banco armazena apenas o hash. Eventos aceitos: QR Code, conexão, novas mensagens e atualização de status. Eventos repetidos são ignorados por chave idempotente.

## Backup e operação

- backup diário do volume PostgreSQL e retenção mínima de sete dias;
- monitorar reinícios do contêiner e uso de disco;
- atualizar a imagem primeiro em homologação;
- nunca publicar PostgreSQL, Redis ou a porta 8080 diretamente na internet;
- reconectar pelo painel quando o status for `disconnected` ou `error`.

## Observação de fornecedor

A Evolution API baseada em WhatsApp Web não é a API oficial da Meta e pode sofrer desconexões ou bloqueios. Cada clínica deve aceitar esse risco. A API oficial pode ser ofertada como alternativa.
