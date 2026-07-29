# Plano de implementação e critérios de aceite

## Fase 1 — Fundação

Arquitetura, GitHub, ambientes, Supabase, autenticação, migrações, RLS, observabilidade e CI/CD.

**Aceite:** usuários de cada papel acessam somente dados autorizados; recuperação de senha e auditoria funcionam; nenhum segredo está no cliente.

## Fase 2 — Marketplace

Perfis, busca encadeada, convênios, especialidades, avaliações, planos e visitas.

**Aceite:** filtros usam dados persistentes; limite gratuito é consistente; selo depende de plano e verificação.

## Fase 3 — CRM, agenda e comunicação

Funil, pacientes, tarefas, agenda, mensagens, origens e notificações.

**Aceite:** mensagens não duplicam; origem é registrada; conflitos de agenda são bloqueados; lembretes possuem logs.

## Fase 4 — ERP e pagamentos

Caixa, contas, despesas, DRE, links, Asaas sandbox e conciliação.

**Aceite:** pagamento confirmado gera um único lançamento; estorno preserva histórico; totais fecham nos períodos.

## Fase 5 — Backoffice

Cadastros, suporte, planos, permissões, auditoria, catálogos e integrações.

**Aceite:** ações sensíveis exigem permissão e aparecem na auditoria.

## Fase 6 — Homologação e produção

Testes, acessibilidade, desempenho, segurança, backups, domínio, documentos legais e treinamento.

**Aceite:** checklist aprovado; restauração testada; erros críticos resolvidos; responsáveis assinam a homologação.

## Regras contratuais recomendadas

- Pagamentos por marco aprovado.
- Código, banco, domínio e contas pertencem à Rede Maternar.
- Documentação e testes fazem parte da entrega.
- Definir garantia de correção, suporte e SLA.
- Proibir dependência de contas pessoais do desenvolvedor.
- Exigir plano de saída e transferência para outro fornecedor.

