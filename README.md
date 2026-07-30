# Rede Maternar v0.8

## Banco de dados

O banco real é definido por migrações na pasta `supabase/`. Consulte
`supabase/README.md` antes de configurar ou alterar o projeto Supabase.

MVP local consolidado da plataforma de coordenação do cuidado materno-infantil.

## Executar

Requer Node.js 22 ou superior.

```bash
npm install
npm run dev
npm test
npm run build
```

## Acessos de demonstração

Senha comum: `123456`.

| Perfil | E-mail |
|---|---|
| Administradora | `admin@redematernar.com` |
| Profissional — Plano Anual | `profissional@redematernar.com` |
| Profissional — Comunidade | `gratuito@redematernar.com` |
| Paciente | `paciente@redematernar.com` |

O login identifica o papel e redireciona automaticamente. A paciente entra apenas por convite e não possui busca livre de profissionais.

## Arquitetura

- `src/permissions`: autorização central por papel, status e plano.
- `src/repositories`: adapter de persistência local substituível por API.
- `src/services`: regras transversais; o cálculo financeiro oficial vive em um único serviço.
- `src/modules/medical-records`: domínio longitudinal, consentimento, linha do tempo imutável e auditoria.
- `src/pages`, `src/layouts`, `src/components`: apresentação e navegação dos portais.

## Natureza do protótipo

Autenticação, persistência, pagamentos e arquivos são simulações locais. Não há cobrança, upload, criptografia ponta a ponta ou segurança clínica de produção. Consulte `PROXIMOS-PASSOS.md`.
