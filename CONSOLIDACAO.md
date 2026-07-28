# Consolidação das versões

| Referência | Contribuição preservada |
|---|---|
| v0.1 | Base React/Vite, landing e separação inicial dos portais |
| v0.2 | ZIP contém somente diretórios vazios; nenhuma implementação |
| v0.3 | Autenticação, rotas protegidas, perfil e aprovação profissional |
| v0.4 | Convites e vínculo inicial de pacientes |
| v0.5 | Agenda e agendamentos |
| v0.6 | Conversas entre paciente e profissional |
| v0.7 | Pagamentos, financeiro e carteira simulados |
| v0.7.5 | Planos, gates, rede, indicações e primeira versão de prontuário |
| v0.8 | Finanças oficiais, permissões centralizadas e prontuário longitudinal/auditoria |

## Conflitos resolvidos

- Percentuais antigos de 20% (texto/indicações) e 5% (código financeiro) são inválidos. A regra oficial é 15% de indicação e 8% da plataforma, ambos após gateway.
- O recebedor de indicação deve possuir Plano Anual.
- Valores do serviço financeiro são inteiros em centavos e a soma das parcelas fecha no valor bruto.
- Registros clínicos não são sobrescritos: correções são adendos ou novas versões.
- Expiração e revogação bloqueiam novos acessos sem apagar histórico ou auditoria.

## Decisões

A v0.7.5 foi usada como base por ser o superset mais recente. A v0.8 foi adicionada em camadas de domínio, serviços, repositórios e permissões para permitir a troca futura do armazenamento local por backend.
