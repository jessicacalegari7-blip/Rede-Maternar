-- Extensões de estados necessárias para o CRM, agenda e financeiro profissionais.
alter type public.financial_entry_status add value if not exists 'partially_paid';
alter type public.financial_entry_status add value if not exists 'refunded';
alter type public.appointment_status add value if not exists 'waiting';
alter type public.appointment_status add value if not exists 'rescheduled';

