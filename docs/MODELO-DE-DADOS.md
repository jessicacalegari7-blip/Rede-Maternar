# Modelo inicial de dados

## Identidade e acesso

`users`, `profiles`, `roles`, `permissions`, `user_roles`, `sessions`, `consents`, `audit_logs`.

## Marketplace

`professional_profiles`, `specialties`, `professional_specialties`, `locations`, `insurances`, `professional_insurances`, `services`, `profile_views`, `whatsapp_clicks`, `reviews`, `review_reports`.

## Pacientes e vínculos

`patient_profiles`, `professional_patient_links`, `invitations`, `emergency_contacts`, `files`, `file_permissions`.

## CRM e comunicação

## Organização e equipe

`organizations`, `organization_members`, `professional_profiles`, `professional_schedules`.

Uma organização representa uma clínica ou operação individual. Todos os registros operacionais devem conter `organization_id`; atendimentos e agendas também devem conter `professional_id`. O vínculo de equipe guarda função, status e permissões individuais.

Leads e agendamentos devem registrar `requested_professional_id` e `assigned_professional_id`. O primeiro preserva a escolha da paciente; o segundo identifica quem efetivamente realizará o atendimento.

`leads`, `pipeline_stages`, `lead_stage_history`, `tasks`, `activities`, `conversations`, `conversation_participants`, `messages`, `message_attachments`, `channels`, `channel_connections`, `webhook_events`, `notification_templates`, `notification_jobs`, `notification_deliveries`.

## Agenda e atendimento

`availability_rules`, `schedule_blocks`, `appointments`, `appointment_status_history`, `attendance_events`, `encounters`, `returns`, `teleconference_rooms`.

## ERP e pagamentos

`plans`, `subscriptions`, `charges`, `payments`, `refunds`, `payment_webhook_events`, `cash_sessions`, `cash_entries`, `accounts_payable`, `accounts_receivable`, `cost_categories`, `cost_entries`, `tax_provisions`, `payroll_entries`, `invoices`, `dre_snapshots`.

Adicionar `professional_settlements` e `settlement_items` para demonstrar valor bruto, taxa do meio de pagamento, taxa da clínica, retenções, ajustes e repasse líquido por profissional e atendimento.

## Backoffice

`support_tickets`, `ticket_messages`, `verification_requests`, `verification_documents`, `admin_notes`, `system_settings`, `integration_health`.

Todas as tabelas devem ter identificador, datas, autoria quando aplicável, índices, restrições, política de retenção e RLS.
