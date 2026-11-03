-- Allow the authenticated backend worker to recover pending Asaas events.
-- Keep the grant column-scoped: the worker cannot insert, update or delete events.

revoke select on table public.asaas_webhook_events from service_role;
grant select (
  id,
  asaas_environment,
  payload,
  processing_status,
  attempts,
  received_at
) on table public.asaas_webhook_events to service_role;

notify pgrst, 'reload schema';
