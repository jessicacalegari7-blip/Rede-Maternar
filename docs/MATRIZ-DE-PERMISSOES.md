# Matriz resumida de permissões

| Recurso | Visitante | Paciente | Profissional | Suporte | Financeiro | Admin |
|---|---|---|---|---|---|---|
| Marketplace público | Ler | Ler | Gerir próprio perfil | Ler | Ler | Gerir |
| Dados da paciente | Não | Próprios | Vinculadas e autorizadas | Mínimo necessário | Não clínicos | Conforme função |
| Agenda | Não | Própria | Própria | Suporte limitado | Leitura financeira | Gerir |
| Mensagens | Não | Próprias | Próprias/vinculadas | Somente chamado autorizado | Não | Auditoria restrita |
| Prontuário | Não | Próprio | Autorizado | Não | Não | Excepcional e auditado |
| Financeiro profissional | Não | Próprios pagamentos | Próprio | Não | Autorizado | Gerir |
| Planos e assinaturas | Ver | Não | Própria | Leitura | Gerir | Gerir |
| Usuários e permissões | Não | Não | Não | Limitado | Não | Gerir |
| Auditoria | Não | Não | Não | Próprias ações | Financeira | Completa autorizada |

Implementar com papéis, escopos, RLS e verificações no servidor. Não confiar apenas em esconder botões na interface.

