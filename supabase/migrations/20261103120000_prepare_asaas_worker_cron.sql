-- Prepare explicit controls for the five-minute Premium invite worker schedule.
-- Applying this migration does not create or activate any cron job.

create or replace function public.enable_asaas_worker_cron()
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  existing_job_id bigint;
  matching_jobs integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('materplace:asaas-worker-cron-config',0));

  if not exists(select 1 from vault.secrets where name='asaas_worker_cron_secret') then
    raise exception 'Worker cron secret is not configured in Vault';
  end if;

  select count(*),min(jobid)
    into matching_jobs,existing_job_id
  from cron.job
  where jobname='materplace-asaas-worker-5m';

  if matching_jobs>1 then
    raise exception 'Duplicate MaterPlace worker cron jobs require manual reconciliation';
  end if;

  if matching_jobs=1 then
    perform cron.alter_job(
      existing_job_id,
      schedule:='*/5 * * * *',
      command:='select public.dispatch_asaas_worker_once();',
      active:=true
    );
    return existing_job_id;
  end if;

  return cron.schedule(
    'materplace-asaas-worker-5m',
    '*/5 * * * *',
    'select public.dispatch_asaas_worker_once();'
  );
end $$;

create or replace function public.disable_asaas_worker_cron()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  target_job_id bigint;
  disabled_count integer:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('materplace:asaas-worker-cron-config',0));
  for target_job_id in
    select jobid from cron.job where jobname='materplace-asaas-worker-5m' and active
  loop
    perform cron.alter_job(target_job_id,active:=false);
    disabled_count:=disabled_count+1;
  end loop;
  return disabled_count;
end $$;

alter function public.enable_asaas_worker_cron() owner to postgres;
alter function public.disable_asaas_worker_cron() owner to postgres;

revoke all on function public.enable_asaas_worker_cron() from public,anon,authenticated,service_role;
revoke all on function public.disable_asaas_worker_cron() from public,anon,authenticated,service_role;

comment on function public.enable_asaas_worker_cron() is
  'Explicitly activates the unique five-minute MaterPlace Asaas worker schedule. Not called by migrations.';
comment on function public.disable_asaas_worker_cron() is
  'Immediately deactivates every active MaterPlace Asaas worker schedule with the canonical job name.';
