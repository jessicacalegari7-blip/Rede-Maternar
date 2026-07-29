# Rede Maternar — Pacote de Transferência Técnica

Este pacote reúne o código-fonte do protótipo, a especificação do produto e os documentos necessários para um programador transformar a demonstração em uma plataforma real.

## Estado atual

- O front-end demonstra Marketplace, CRM, ERP, agenda, teleconsultas, mensagens e backoffice.
- Os dados ainda são fictícios e parte deles usa `localStorage`.
- Pagamentos, WhatsApp, redes sociais, videoconferência, notas fiscais e notificações são simulações.
- Não utilizar dados pessoais ou clínicos reais antes da implementação do backend, autenticação, RLS, auditoria e revisão de segurança.

## Conteúdo

- `codigo-fonte/`: aplicação React/Vite atual.
- `documentacao/PRD-Rede-Maternar.docx`: documento principal editável.
- `documentacao/PRD-Rede-Maternar.md`: versão Markdown.
- `documentacao/REGRAS-DE-NEGOCIO.md`
- `documentacao/MATRIZ-DE-PERMISSOES.md`
- `documentacao/MODELO-DE-DADOS.md`
- `documentacao/SEGURANCA-LGPD.md`
- `documentacao/PLANO-DE-IMPLEMENTACAO-E-ACEITE.md`

## Início recomendado

1. Revisar o PRD e registrar dúvidas.
2. Fazer inventário técnico do código.
3. Definir arquitetura final.
4. Criar ambientes separados de desenvolvimento, homologação e produção.
5. Implementar banco, autenticação e permissões antes das integrações externas.
6. Homologar cada módulo com critérios de aceite.

## Contas e propriedade

GitHub, Supabase, Vercel, domínio e integrações devem permanecer em contas pertencentes à Rede Maternar. Conceder acesso ao desenvolvedor por convite e nunca compartilhar senhas pessoais.

## Link da demonstração

https://rede-maternar-demo.jessica-calegari7.chatgpt.site

