create or replace function public.validate_financial_entry_integrity() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.amount_cents < coalesce(old.received_amount_cents,0) then
    raise exception 'O valor do lançamento não pode ser menor que o total já pago';
  end if;
  if new.status='cancelled' and coalesce(old.received_amount_cents,0)>0 then
    raise exception 'Um lançamento com pagamentos não pode ser cancelado sem estorno';
  end if;
  new.gross_amount_cents:=new.amount_cents;
  new.competence_date:=coalesce(new.competence_date,new.due_date,new.created_at::date,current_date);
  return new;
end $$;

drop trigger if exists financial_entries_validate_integrity on public.financial_entries;
create trigger financial_entries_validate_integrity before update on public.financial_entries
for each row execute function public.validate_financial_entry_integrity();
