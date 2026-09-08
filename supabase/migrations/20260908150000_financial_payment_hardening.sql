-- Impede baixas inconsistentes e referências financeiras entre organizações.
create or replace function public.record_financial_payment(target_entry_id uuid,payment_amount_cents bigint,target_payment_method_id uuid,target_cash_account_id uuid,idempotency_key text,payment_notes text default null)
returns public.financial_entries language plpgsql security definer set search_path='' as $$
declare entry public.financial_entries; total_paid bigint; fee bigint:=0; net bigint; method public.payment_methods; account public.cash_accounts;
begin
  select * into entry from public.financial_entries where id=target_entry_id for update;
  if entry.id is null then raise exception 'Lançamento não encontrado'; end if;
  if not public.can_access_organization_module(entry.organization_id,'finance','write') then raise exception 'Acesso negado ao financeiro'; end if;
  if entry.status in ('cancelled','refunded') then raise exception 'Não é possível baixar um lançamento cancelado ou estornado'; end if;
  if payment_amount_cents<=0 then raise exception 'O valor deve ser maior que zero'; end if;
  if exists(select 1 from public.financial_transactions t where t.organization_id=entry.organization_id and t.idempotency_key=record_financial_payment.idempotency_key) then return entry; end if;
  select coalesce(sum(t.amount_cents),0) into total_paid from public.financial_transactions t where t.financial_entry_id=entry.id and t.transaction_type in ('receipt','payment');
  if total_paid>=entry.amount_cents then raise exception 'Este lançamento já está totalmente baixado'; end if;
  if payment_amount_cents>entry.amount_cents-total_paid then raise exception 'O valor informado é maior que o saldo restante'; end if;
  if target_payment_method_id is not null then
    select * into method from public.payment_methods where id=target_payment_method_id and organization_id=entry.organization_id and active;
    if method.id is null then raise exception 'Forma de pagamento inválida para esta organização'; end if;
  end if;
  if target_cash_account_id is not null then
    select * into account from public.cash_accounts where id=target_cash_account_id and organization_id=entry.organization_id and active;
    if account.id is null then raise exception 'Conta financeira inválida para esta organização'; end if;
  end if;
  fee:=round(payment_amount_cents*coalesce(method.percentage_fee,0)/100)::bigint+coalesce(method.fixed_fee_cents,0);
  net:=greatest(payment_amount_cents-fee,0);
  insert into public.financial_transactions(organization_id,financial_entry_id,cash_account_id,payment_method_id,transaction_type,amount_cents,fee_cents,net_amount_cents,idempotency_key,notes,created_by)
  values(entry.organization_id,entry.id,target_cash_account_id,target_payment_method_id,case when entry.type in ('receivable','income') then 'receipt' else 'payment' end,payment_amount_cents,fee,net,idempotency_key,nullif(trim(payment_notes),''),auth.uid());
  total_paid:=total_paid+payment_amount_cents;
  update public.financial_entries set received_amount_cents=total_paid,financial_fee_cents=financial_fee_cents+fee,net_received_cents=net_received_cents+net,
    payment_method_id=coalesce(target_payment_method_id,payment_method_id),cash_account_id=coalesce(target_cash_account_id,cash_account_id),
    status=case when total_paid>=amount_cents then 'paid'::public.financial_entry_status else 'partially_paid'::public.financial_entry_status end,
    paid_at=case when total_paid>=amount_cents then now() else null end,updated_at=now()
  where id=entry.id returning * into entry;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(entry.organization_id,auth.uid(),'financial_payment_recorded','financial_entry',entry.id,jsonb_build_object('amount_cents',payment_amount_cents,'fee_cents',fee,'transaction_status',entry.status));
  return entry;
end $$;
grant execute on function public.record_financial_payment(uuid,bigint,uuid,uuid,text,text) to authenticated;

-- Corrige lançamentos pagos antigos criados sem os totais auxiliares.
update public.financial_entries
set gross_amount_cents=case when gross_amount_cents=0 then amount_cents else gross_amount_cents end,
    received_amount_cents=case when status='paid' and received_amount_cents=0 then amount_cents else received_amount_cents end,
    net_received_cents=case when status='paid' and net_received_cents=0 then amount_cents else net_received_cents end,
    competence_date=coalesce(competence_date,due_date,created_at::date)
where gross_amount_cents=0 or competence_date is null or (status='paid' and received_amount_cents=0);
