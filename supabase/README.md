# Supabase — Rede Maternar

Esta pasta guarda a definição versionada do banco. Migrações nunca devem conter
senhas ou chaves.

## Primeira aplicação

1. Abra o projeto **Rede Maternar** no Supabase.
2. Entre em **SQL Editor** e crie uma consulta.
3. Copie integralmente `migrations/20260730100000_initial_foundation.sql`.
4. Execute uma única vez e confira se não houve erro.

Depois que a CLI estiver configurada, novas migrações poderão ser aplicadas com
`supabase db push`.

## Segurança

- Login e senhas pertencem ao Supabase Auth.
- Nenhuma senha é armazenada nas tabelas públicas.
- Todas as tabelas operacionais usam Row Level Security (RLS).
- Clínica e profissional independente são organizações isoladas.
- Chaves administrativas nunca devem usar o prefixo `VITE_`.

Esta fundação cobre perfis, organizações, equipes, profissionais, especialidades,
pacientes, leads, agenda e auditoria. Financeiro, mensagens, WhatsApp e avaliações
serão adicionados em migrações próprias após a validação.
