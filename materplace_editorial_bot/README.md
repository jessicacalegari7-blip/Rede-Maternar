# Robô Editorial MaterPlace — primeira entrega

Pipeline Python isolada do front-end. O modo padrão é `mock`: não chama serviços pagos e nunca publica conteúdo. O único status aceito pelo cliente CMS é `draft`.

## O que foi adaptado ao projeto real

- CMS: tabela Supabase `public.news_articles` via PostgREST.
- Estados existentes: `draft`, `published`, `archived`; o robô só aceita `draft`.
- Campos enviados: `slug`, `title`, `seo_title`, `excerpt`, `content`, `category`, `cover_image_url`, `author_name`, `status`, `featured`, `published_at`.
- Aprovação/publicação continuam exclusivas do painel administrativo existente.

## Executar sem custos externos

```powershell
cd materplace_editorial_bot
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m app.main
.venv\Scripts\pytest
```

## Scheduler

`python -m app.scheduler` agenda 06:00, 12:00 e 18:00 em `America/Sao_Paulo`, com uma única instância por tarefa e coalescência.

## Dependências externas ainda não conectadas

- OpenAI: redação, classificação e fact-check em produção.
- Google Trends/News, YouTube, Reddit e X: credenciais ou política de acesso.
- Geração de imagem: provedor a definir; saída obrigatória 1600×900 e sem texto.
- Supabase: aplicar a migration `20260820233000_editorial_bot_foundation.sql` e disponibilizar `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente servidor do robô.

O modo `live` não deve ser ativado antes da implementação e homologação desses adaptadores. A ausência de pauta adequada é tratada como resultado válido.

## Segurança e auditoria

- Nenhuma chave é registrada nos logs.
- A service role nunca vai para o front-end/Vite.
- Cada pauta possui `topic_hash` para idempotência.
- O QualityGate bloqueia fonte primária ausente, fontes insuficientes, afirmação não sustentada e status inseguro.
- Citações literais ainda não são produzidas no mock; no modo live exigirão URL, autoria e trecho verificável.

