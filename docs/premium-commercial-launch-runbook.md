# Plano Premium — ativação e primeiros sete dias

## Travas de abertura

O modo comercial só usa Asaas Production quando as duas variáveis abaixo estão explicitamente `true` no ambiente Production:

- `ASAAS_PRODUCTION_CHARGES_ENABLED`
- `ASAAS_PRODUCTION_COMMERCIAL_ENABLED`

Para pausar imediatamente depois da abertura, manter `ASAAS_PRODUCTION_COMMERCIAL_ENABLED=true`, definir `ASAAS_PRODUCTION_CHARGES_ENABLED=false` e realizar redeploy. Nessa combinação o checkout falha de forma fechada com HTTP 503 e nunca retorna ao Sandbox. Para encerrar definitivamente o modo comercial, desativar a flag comercial somente depois que a trava financeira já estiver carregada no runtime.

## Antes da abertura

- Confirmar webhook Production ativo, API v3, envio sequencial e eventos de Checkout/financeiros necessários.
- Confirmar exatamente um Cron `materplace-asaas-worker-5m` ativo e worker HTTP 200.
- Confirmar outbox sem itens `processing`, `failed` ou `uncertain` antigos.
- Confirmar `ASAAS_PRODUCTION_CHARGES_ENABLED=false` até a autorização final.
- Confirmar preço R$ 59,99, pagamento único e validade de 12 meses.

## Monitoramento — dias 1 a 7

Verificar no início e no fim de cada dia:

- checkouts criados, pagos, expirados e inconclusivos;
- eventos de webhook em `error` ou com tentativas repetidas;
- pedidos pagos sem contrato ativo;
- contratos ativos sem usuário/perfil associado;
- outbox `failed`, `uncertain` ou `processing` além do lease;
- convites não enviados ou expirados;
- perfis completos que não foram publicados automaticamente;
- um único Cron ativo e últimas execuções HTTP 200;
- Cached Egress, Storage e banco no painel Supabase.

Interromper novas cobranças se houver qualquer pedido duplicado, pagamento pago não conciliado por mais de 10 minutos, webhook interrompido, Cron sem duas execuções consecutivas ou crescimento anormal de erros. Manter os registros e corrigir pela conciliação idempotente; nunca apagar pedidos ou reenviar convites em massa.

O Cron diário da Vercel permanece como contingência. Removê-lo somente após sete dias estáveis e autorização específica.
