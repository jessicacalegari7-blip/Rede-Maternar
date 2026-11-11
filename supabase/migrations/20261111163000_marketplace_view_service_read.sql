-- Permite ao renderer server-side consultar somente a view publica do Marketplace.
grant select on public.marketplace_professionals to service_role;

notify pgrst, 'reload schema';
