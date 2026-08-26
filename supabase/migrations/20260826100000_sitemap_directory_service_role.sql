-- Permite que a função serverless autenticada com a chave de serviço
-- leia somente a view pública usada para gerar o sitemap do diretório.
grant select on public.published_clinic_directory to service_role;
