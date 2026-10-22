-- Aarogya Copilot — ABDM-aligned storage schema
-- Run in the Supabase SQL editor. Mirrors FHIR R4 resource shapes so the
-- database can export a bundle without a translation layer.

create table if not exists profiles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default '',
  age          text not null default '',
  gender       text not null default 'unknown'
               check (gender in ('male','female','other','unknown')),
  phone        text not null default '',
  phone_last4  text,
  dob          date,
  abha         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists health_records (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references profiles(id) on delete cascade,
  file_name   text not null,
  doc_type    text not null default 'general_record'
              check (doc_type in ('prescription','lab_report','discharge_summary','diagnostic_report','general_record')),
  text        text not null default '',
  medicines   jsonb not null default '[]'::jsonb,
  labs        jsonb not null default '[]'::jsonb,
  diagnoses   jsonb not null default '[]'::jsonb,
  dates       jsonb not null default '[]'::jsonb,
  doctor      text not null default '',
  facility    text not null default '',
  engine      text not null default 'deterministic' check (engine in ('llm','deterministic')),
  model       text,
  fhir        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists health_records_patient_created_idx
  on health_records (patient_id, created_at desc);
create index if not exists health_records_labs_gin
  on health_records using gin (labs);
create index if not exists health_records_medicines_gin
  on health_records using gin (medicines);

create table if not exists wellness_logs (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references profiles(id) on delete cascade,
  logged_on   date not null default current_date,
  bp          text not null default '',
  sugar       text not null default '',
  weight      text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists wellness_logs_patient_date_idx
  on wellness_logs (patient_id, logged_on desc);

-- Audit trail: every read, write and share is recorded.
create table if not exists audit_log (
  id          bigserial primary key,
  patient_id  uuid,
  action      text not null,
  subject     text,
  actor       text not null default 'caregiver',
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_patient_created_idx
  on audit_log (patient_id, created_at desc);

-- Row level security: a patient sees only their own rows.
alter table profiles       enable row level security;
alter table health_records enable row level security;
alter table wellness_logs  enable row level security;

create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own records" on health_records
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "own wellness" on wellness_logs
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
