-- Telenomily initial schema. Run in the Supabase SQL editor or via supabase db push.
-- Tokens are stored as SHA-256 hashes. The raw invitation token is shown once and never stored.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('patient', 'family', 'presenter')),
  display_name text not null,
  phone_e164 text,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  preferred_name text not null,
  phone_e164 text,
  time_zone text not null default 'America/New_York',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.family_links (
  patient_id uuid not null references public.patients (id) on delete cascade,
  family_profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (patient_id, family_profile_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  token_hash text not null unique,
  purpose text not null check (purpose in ('family_link', 'demo_family_session')),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  page_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents (id) on delete set null,
  patient_id uuid not null references public.patients (id) on delete cascade,
  model text not null,
  raw_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  status text not null check (status in ('draft', 'confirmed', 'archived')),
  source_document_id uuid references public.documents (id) on delete set null,
  extraction_id uuid references public.extractions (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  name text not null,
  ingredients jsonb not null default '[]'::jsonb,
  strength_value numeric,
  strength_unit text,
  amount_per_dose text,
  route text,
  formulation text,
  release_type text,
  frequency text,
  timings jsonb not null default '[]'::jsonb,
  instruction_kind text not null check (instruction_kind in ('start', 'continue', 'stop', 'as_needed')),
  duration text,
  end_date date,
  special_instructions text,
  source_text text not null default '',
  missing_fields jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  sort_order int not null default 0
);

create table public.dose_occurrences (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  plan_version_id uuid not null references public.plan_versions (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  scheduled_for timestamptz not null,
  instructions text not null,
  state text not null default 'pending' check (state in ('pending', 'reported_taken', 'reported_not_taken', 'unsure', 'no_response')),
  unique (medication_id, scheduled_for)
);

create table public.dose_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  occurrence_id uuid references public.dose_occurrences (id) on delete cascade,
  plan_version_id uuid not null references public.plan_versions (id) on delete cascade,
  state text not null check (state in ('reported_taken', 'reported_not_taken', 'unsure', 'no_response')),
  source text not null check (source in ('patient_report', 'document_extraction', 'code_comparison', 'pharmacist_statement', 'system')),
  quote text,
  call_id uuid,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.symptom_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  call_id uuid,
  text text not null,
  urgent boolean not null default false,
  source text not null default 'patient_report',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  plan_version_id uuid references public.plan_versions (id) on delete set null,
  room_name text,
  status text not null default 'open' check (status in ('open', 'finished')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.scan_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.scan_sessions (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  plan_version_id uuid references public.plan_versions (id) on delete set null,
  request_id text not null,
  captured_at timestamptz not null,
  kind text not null check (kind in ('package', 'pill', 'foreign', 'missing')),
  outcome text not null check (outcome in ('on_plan', 'not_on_plan', 'expired', 'missing', 'cant_confirm', 'possible_match', 'candidate')),
  plan_match text,
  expiration_status text,
  matched_medication_id uuid,
  spoken_script text not null,
  detail text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  model text,
  source text not null default 'code_comparison',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.reference_products (
  id text primary key,
  display_name text not null,
  ingredients jsonb not null,
  strength_value numeric,
  strength_unit text,
  formulation text,
  release_type text,
  route text,
  provenance text not null
);

create table public.pill_references (
  id text primary key,
  name text not null,
  imprint_side_a text not null,
  imprint_side_b text,
  requires_both_sides boolean not null,
  shape text not null,
  color text not null,
  scoring text,
  provenance text not null
);

create table public.foreign_mappings (
  id text primary key,
  aliases jsonb not null,
  language text not null,
  ingredients jsonb not null,
  strength_value numeric not null,
  strength_unit text not null,
  formulation text not null,
  release_type text not null,
  route text not null,
  us_candidate_name text not null,
  reference_note text not null,
  preverified boolean not null
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  purpose text not null check (purpose in ('reminder', 'pharmacy', 'medicine_check')),
  status text not null check (status in ('queued', 'dialing', 'ringing', 'answered', 'busy', 'rejected', 'unanswered', 'disconnected', 'provider_error', 'completed')),
  idempotency_key text not null unique,
  dose_occurrence_id uuid references public.dose_occurrences (id) on delete set null,
  room_name text,
  opening_script text,
  summary text,
  provider_event_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pharmacy_updates (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  call_id uuid references public.calls (id) on delete set null,
  in_stock boolean,
  quoted_name text,
  quoted_strength text,
  price_text text,
  statement text not null,
  decision text not null check (decision in ('preverified_candidate', 'needs_review', 'rejected', 'recorded')),
  reason text not null,
  changes_plan boolean not null default false,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.shopping_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  medication_id uuid references public.medications (id) on delete set null,
  medication_key text not null,
  kind text not null check (kind in ('replace_expired', 'obtain_missing')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

create unique index shopping_tasks_open_unique
  on public.shopping_tasks (patient_id, medication_key, kind)
  where status = 'open';

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null,
  detail text not null default '',
  source text not null check (source in ('patient_report', 'document_extraction', 'code_comparison', 'pharmacist_statement', 'system')),
  status text not null,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  livekit_room text not null unique,
  purpose text not null,
  patient_identity text not null,
  call_id uuid references public.calls (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.idempotency_keys (
  key text primary key,
  scope text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create index medications_plan_idx on public.medications (plan_version_id);
create index doses_patient_time_idx on public.dose_occurrences (patient_id, scheduled_for);
create index activity_patient_time_idx on public.activity_events (patient_id, created_at desc);
create index calls_patient_idx on public.calls (patient_id, created_at desc);
create index scan_results_patient_idx on public.scan_results (patient_id, created_at desc);

alter table public.dose_reports
  add constraint dose_reports_call_fk foreign key (call_id) references public.calls (id) on delete set null;

alter table public.symptom_reports
  add constraint symptom_reports_call_fk foreign key (call_id) references public.calls (id) on delete set null;

create or replace function public.can_access_patient(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patients p
    where p.id = pid
      and (
        p.profile_id = auth.uid()
        or exists (
          select 1 from public.family_links fl
          where fl.patient_id = p.id
            and fl.family_profile_id = auth.uid()
            and fl.status = 'active'
        )
        or exists (
          select 1 from public.profiles me
          where me.id = auth.uid()
            and me.role = 'presenter'
            and p.is_demo
        )
      )
  );
$$;

revoke all on function public.can_access_patient(uuid) from public;
grant execute on function public.can_access_patient(uuid) to authenticated;

create or replace function public.create_patient_profile(display_name text, phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_exists';
  end if;
  insert into public.profiles (id, role, display_name, phone_e164)
  values (auth.uid(), 'patient', display_name, nullif(phone, ''));
  insert into public.patients (profile_id, preferred_name, phone_e164)
  values (auth.uid(), display_name, nullif(phone, ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.create_family_profile(display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_exists';
  end if;
  insert into public.profiles (id, role, display_name)
  values (auth.uid(), 'family', display_name);
end;
$$;

create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
  hashed text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'family') then
    raise exception 'family_profile_required';
  end if;
  hashed := encode(digest(raw_token, 'sha256'), 'hex');
  select * into inv from public.invitations where token_hash = hashed for update;
  if not found then
    raise exception 'invalid';
  end if;
  if inv.used_at is not null then
    raise exception 'used';
  end if;
  if inv.expires_at <= now() then
    raise exception 'expired';
  end if;
  if inv.purpose <> 'family_link' then
    raise exception 'wrong_purpose';
  end if;
  insert into public.family_links (patient_id, family_profile_id, status)
  values (inv.patient_id, auth.uid(), 'active')
  on conflict (patient_id, family_profile_id)
  do update set status = 'active';
  update public.invitations
    set used_at = now(), used_by = auth.uid()
    where id = inv.id;
  return inv.patient_id;
end;
$$;

revoke all on function public.create_patient_profile(text, text) from public;
revoke all on function public.create_family_profile(text) from public;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.create_patient_profile(text, text) to authenticated;
grant execute on function public.create_family_profile(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.family_links enable row level security;
alter table public.invitations enable row level security;
alter table public.documents enable row level security;
alter table public.extractions enable row level security;
alter table public.plan_versions enable row level security;
alter table public.medications enable row level security;
alter table public.dose_occurrences enable row level security;
alter table public.dose_reports enable row level security;
alter table public.symptom_reports enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.scan_results enable row level security;
alter table public.reference_products enable row level security;
alter table public.pill_references enable row level security;
alter table public.foreign_mappings enable row level security;
alter table public.calls enable row level security;
alter table public.pharmacy_updates enable row level security;
alter table public.shopping_tasks enable row level security;
alter table public.activity_events enable row level security;
alter table public.rooms enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy patients_select on public.patients
  for select to authenticated using (public.can_access_patient(id));

create policy links_select on public.family_links
  for select to authenticated using (
    family_profile_id = auth.uid() or public.can_access_patient(patient_id)
  );

create policy invites_none on public.invitations
  for select to authenticated using (false);

create policy documents_select on public.documents
  for select to authenticated using (public.can_access_patient(patient_id));
create policy extractions_select on public.extractions
  for select to authenticated using (public.can_access_patient(patient_id));
create policy plans_select on public.plan_versions
  for select to authenticated using (public.can_access_patient(patient_id));
create policy meds_select on public.medications
  for select to authenticated using (public.can_access_patient(patient_id));
create policy doses_select on public.dose_occurrences
  for select to authenticated using (public.can_access_patient(patient_id));
create policy reports_select on public.dose_reports
  for select to authenticated using (public.can_access_patient(patient_id));
create policy symptoms_select on public.symptom_reports
  for select to authenticated using (public.can_access_patient(patient_id));
create policy sessions_select on public.scan_sessions
  for select to authenticated using (public.can_access_patient(patient_id));
create policy results_select on public.scan_results
  for select to authenticated using (public.can_access_patient(patient_id));
create policy calls_select on public.calls
  for select to authenticated using (public.can_access_patient(patient_id));
create policy pharmacy_select on public.pharmacy_updates
  for select to authenticated using (public.can_access_patient(patient_id));
create policy tasks_select on public.shopping_tasks
  for select to authenticated using (public.can_access_patient(patient_id));
create policy activity_select on public.activity_events
  for select to authenticated using (public.can_access_patient(patient_id));
create policy rooms_select on public.rooms
  for select to authenticated using (public.can_access_patient(patient_id));

create policy references_read on public.reference_products
  for select to authenticated using (true);
create policy pills_read on public.pill_references
  for select to authenticated using (true);
create policy foreign_read on public.foreign_mappings
  for select to authenticated using (true);

create policy idempotency_none on public.idempotency_keys
  for select to authenticated using (false);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.can_access_patient(((storage.foldername(name))[1])::uuid)
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'activity_events',
    'dose_reports',
    'dose_occurrences',
    'calls',
    'scan_results',
    'symptom_reports',
    'pharmacy_updates',
    'shopping_tasks',
    'rooms'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
