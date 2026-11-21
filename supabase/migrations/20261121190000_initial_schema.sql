-- The Family Care Hub: initial schema and RLS
-- Apply only to the intended development/hackathon Supabase project.
-- All sample care data must be synthetic. This migration does not create auth users.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Core identity and family tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN', 'CAREGIVER', 'CONTRIBUTOR', 'VIEWER')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

-- Membership helpers are declared after family_members exists.
-- SECURITY DEFINER helpers avoid recursive RLS evaluation when checking membership.
-- They expose only boolean membership/role checks, not table contents.
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_family_role(
  p_family_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = (select auth.uid())
      and fm.role = any(p_roles)
  );
$$;

revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.has_family_role(uuid, text[]) from public;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.has_family_role(uuid, text[]) to authenticated;

-- A family creator is automatically its first ADMIN member.
create or replace function public.add_family_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.created_by, 'ADMIN')
  on conflict (family_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_family_created_add_admin on public.families;
create trigger on_family_created_add_admin
after insert on public.families
for each row execute function public.add_family_creator_as_admin();

-- Create a profile automatically when an Auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Care recipient and invitation tables
-- ---------------------------------------------------------------------------

create table if not exists public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  date_of_birth date,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  role text not null check (role in ('CAREGIVER', 'CONTRIBUTOR', 'VIEWER')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invitations_family_id_idx on public.invitations(family_id);
create index if not exists invitations_email_idx on public.invitations(lower(email));

-- ---------------------------------------------------------------------------
-- Medical and coordination tables
-- ---------------------------------------------------------------------------

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  care_recipient_id uuid not null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  record_type text not null check (
    record_type in ('LAB_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'IMAGING', 'OTHER')
  ),
  file_path text not null,
  file_name text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (care_recipient_id, family_id)
    references public.care_recipients(id, family_id) on delete cascade
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  care_recipient_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  priority text not null default 'MEDIUM'
    check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (care_recipient_id, family_id)
    references public.care_recipients(id, family_id) on delete cascade
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  care_recipient_id uuid not null,
  title text not null,
  provider_name text,
  location text,
  scheduled_at timestamptz not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (care_recipient_id, family_id)
    references public.care_recipients(id, family_id) on delete cascade
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  care_recipient_id uuid not null,
  medication_name text not null,
  dosage text,
  instructions text,
  prescribed_by text,
  start_date date,
  end_date date,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (care_recipient_id, family_id)
    references public.care_recipients(id, family_id) on delete cascade,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.medicine_refills (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  due_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'COMPLETED', 'SKIPPED')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  status text not null default 'UNREAD' check (status in ('UNREAD', 'READ')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  care_recipient_id uuid,
  event_type text not null,
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (care_recipient_id, family_id)
    references public.care_recipients(id, family_id) on delete cascade
);

-- Append-only for ordinary authenticated users: no UPDATE or DELETE policy is created.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.family_updates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists family_members_user_id_idx on public.family_members(user_id);
create index if not exists care_recipients_family_id_idx on public.care_recipients(family_id);
create index if not exists medical_records_family_created_idx on public.medical_records(family_id, created_at desc);
create index if not exists medical_records_recipient_idx on public.medical_records(care_recipient_id);
create index if not exists tasks_family_status_due_idx on public.tasks(family_id, status, due_at);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists appointments_family_scheduled_idx on public.appointments(family_id, scheduled_at);
create index if not exists prescriptions_family_recipient_idx on public.prescriptions(family_id, care_recipient_id);
create index if not exists medicine_refills_prescription_due_idx on public.medicine_refills(prescription_id, due_at);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists timeline_family_occurred_idx on public.timeline_events(family_id, occurred_at desc);
create index if not exists activity_logs_family_created_idx on public.activity_logs(family_id, created_at desc);
create index if not exists family_updates_family_created_idx on public.family_updates(family_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists families_set_updated_at on public.families;
create trigger families_set_updated_at before update on public.families
for each row execute function public.set_updated_at();

drop trigger if exists care_recipients_set_updated_at on public.care_recipients;
create trigger care_recipients_set_updated_at before update on public.care_recipients
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists prescriptions_set_updated_at on public.prescriptions;
create trigger prescriptions_set_updated_at before update on public.prescriptions
for each row execute function public.set_updated_at();

drop trigger if exists family_updates_set_updated_at on public.family_updates;
create trigger family_updates_set_updated_at before update on public.family_updates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.care_recipients enable row level security;
alter table public.invitations enable row level security;
alter table public.medical_records enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.prescriptions enable row level security;
alter table public.medicine_refills enable row level security;
alter table public.notifications enable row level security;
alter table public.timeline_events enable row level security;
alter table public.activity_logs enable row level security;
alter table public.family_updates enable row level security;

-- Profiles: private to the account owner.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Families
drop policy if exists families_select_member on public.families;
create policy families_select_member on public.families
for select to authenticated
using (public.is_family_member(id));

drop policy if exists families_insert_creator on public.families;
create policy families_insert_creator on public.families
for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists families_update_admin on public.families;
create policy families_update_admin on public.families
for update to authenticated
using (public.has_family_role(id, array['ADMIN']))
with check (public.has_family_role(id, array['ADMIN']));

drop policy if exists families_delete_admin on public.families;
create policy families_delete_admin on public.families
for delete to authenticated
using (public.has_family_role(id, array['ADMIN']));

-- Family members: creator membership is inserted by the SECURITY DEFINER trigger.
drop policy if exists family_members_select_member on public.family_members;
create policy family_members_select_member on public.family_members
for select to authenticated
using (public.is_family_member(family_id));

drop policy if exists family_members_insert_admin on public.family_members;
create policy family_members_insert_admin on public.family_members
for insert to authenticated
with check (public.has_family_role(family_id, array['ADMIN']));

drop policy if exists family_members_update_admin on public.family_members;
create policy family_members_update_admin on public.family_members
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN']))
with check (public.has_family_role(family_id, array['ADMIN']));

drop policy if exists family_members_delete_admin_or_self on public.family_members;
create policy family_members_delete_admin_or_self on public.family_members
for delete to authenticated
using (
  user_id = (select auth.uid())
  or public.has_family_role(family_id, array['ADMIN'])
);

-- Care recipients
drop policy if exists care_recipients_select_member on public.care_recipients;
create policy care_recipients_select_member on public.care_recipients
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists care_recipients_insert_contributor on public.care_recipients;
create policy care_recipients_insert_contributor on public.care_recipients
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

drop policy if exists care_recipients_update_contributor on public.care_recipients;
create policy care_recipients_update_contributor on public.care_recipients
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']))
with check (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']));

drop policy if exists care_recipients_delete_admin_caregiver on public.care_recipients;
create policy care_recipients_delete_admin_caregiver on public.care_recipients
for delete to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']));

-- Invitations: token hashes only; invitation acceptance will be implemented server-side.
drop policy if exists invitations_select_admin on public.invitations;
create policy invitations_select_admin on public.invitations
for select to authenticated using (public.has_family_role(family_id, array['ADMIN']));

drop policy if exists invitations_insert_admin on public.invitations;
create policy invitations_insert_admin on public.invitations
for insert to authenticated
with check (
  invited_by = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN'])
);

drop policy if exists invitations_update_admin on public.invitations;
create policy invitations_update_admin on public.invitations
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN']))
with check (public.has_family_role(family_id, array['ADMIN']));

drop policy if exists invitations_delete_admin on public.invitations;
create policy invitations_delete_admin on public.invitations
for delete to authenticated using (public.has_family_role(family_id, array['ADMIN']));

-- Medical records
drop policy if exists medical_records_select_member on public.medical_records;
create policy medical_records_select_member on public.medical_records
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists medical_records_insert_contributor on public.medical_records;
create policy medical_records_insert_contributor on public.medical_records
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

drop policy if exists medical_records_update_contributor on public.medical_records;
create policy medical_records_update_contributor on public.medical_records
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']))
with check (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']));

drop policy if exists medical_records_delete_admin_caregiver on public.medical_records;
create policy medical_records_delete_admin_caregiver on public.medical_records
for delete to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']));

-- Tasks
drop policy if exists tasks_select_member on public.tasks;
create policy tasks_select_member on public.tasks
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists tasks_insert_contributor on public.tasks;
create policy tasks_insert_contributor on public.tasks
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

drop policy if exists tasks_update_contributor on public.tasks;
create policy tasks_update_contributor on public.tasks
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']))
with check (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']));

drop policy if exists tasks_delete_admin_caregiver on public.tasks;
create policy tasks_delete_admin_caregiver on public.tasks
for delete to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']));

-- Appointments
drop policy if exists appointments_select_member on public.appointments;
create policy appointments_select_member on public.appointments
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists appointments_insert_contributor on public.appointments;
create policy appointments_insert_contributor on public.appointments
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

drop policy if exists appointments_update_contributor on public.appointments;
create policy appointments_update_contributor on public.appointments
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']))
with check (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']));

drop policy if exists appointments_delete_admin_caregiver on public.appointments;
create policy appointments_delete_admin_caregiver on public.appointments
for delete to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']));

-- Prescriptions
drop policy if exists prescriptions_select_member on public.prescriptions;
create policy prescriptions_select_member on public.prescriptions
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists prescriptions_insert_caregiver on public.prescriptions;
create policy prescriptions_insert_caregiver on public.prescriptions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER'])
);

drop policy if exists prescriptions_update_caregiver on public.prescriptions;
create policy prescriptions_update_caregiver on public.prescriptions
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']))
with check (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']));

drop policy if exists prescriptions_delete_admin on public.prescriptions;
create policy prescriptions_delete_admin on public.prescriptions
for delete to authenticated
using (public.has_family_role(family_id, array['ADMIN']));

-- Refills inherit access from their parent prescription.
drop policy if exists medicine_refills_select_member on public.medicine_refills;
create policy medicine_refills_select_member on public.medicine_refills
for select to authenticated
using (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.is_family_member(p.family_id)
  )
);

drop policy if exists medicine_refills_insert_caregiver on public.medicine_refills;
create policy medicine_refills_insert_caregiver on public.medicine_refills
for insert to authenticated
with check (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.has_family_role(p.family_id, array['ADMIN', 'CAREGIVER'])
  )
);

drop policy if exists medicine_refills_update_caregiver on public.medicine_refills;
create policy medicine_refills_update_caregiver on public.medicine_refills
for update to authenticated
using (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.has_family_role(p.family_id, array['ADMIN', 'CAREGIVER'])
  )
)
with check (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.has_family_role(p.family_id, array['ADMIN', 'CAREGIVER'])
  )
);

drop policy if exists medicine_refills_delete_admin on public.medicine_refills;
create policy medicine_refills_delete_admin on public.medicine_refills
for delete to authenticated
using (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.has_family_role(p.family_id, array['ADMIN'])
  )
);

-- Notifications: each user sees and updates only their own notifications.
drop policy if exists notifications_select_own_member on public.notifications;
create policy notifications_select_own_member on public.notifications
for select to authenticated
using (user_id = (select auth.uid()) and public.is_family_member(family_id));

drop policy if exists notifications_update_own_member on public.notifications;
create policy notifications_update_own_member on public.notifications
for update to authenticated
using (user_id = (select auth.uid()) and public.is_family_member(family_id))
with check (user_id = (select auth.uid()) and public.is_family_member(family_id));

-- Timeline events
drop policy if exists timeline_events_select_member on public.timeline_events;
create policy timeline_events_select_member on public.timeline_events
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists timeline_events_insert_contributor on public.timeline_events;
create policy timeline_events_insert_contributor on public.timeline_events
for insert to authenticated
with check (
  (created_by is null or created_by = (select auth.uid()))
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

drop policy if exists timeline_events_update_admin_caregiver on public.timeline_events;
create policy timeline_events_update_admin_caregiver on public.timeline_events
for update to authenticated
using (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']))
with check (public.has_family_role(family_id, array['ADMIN', 'CAREGIVER']));

drop policy if exists timeline_events_delete_admin on public.timeline_events;
create policy timeline_events_delete_admin on public.timeline_events
for delete to authenticated using (public.has_family_role(family_id, array['ADMIN']));

-- Activity log: members can read; users can insert events as themselves.
-- No UPDATE or DELETE policy is intentionally provided.
drop policy if exists activity_logs_select_member on public.activity_logs;
create policy activity_logs_select_member on public.activity_logs
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists activity_logs_insert_actor on public.activity_logs;
create policy activity_logs_insert_actor on public.activity_logs
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

-- Family updates
drop policy if exists family_updates_select_member on public.family_updates;
create policy family_updates_select_member on public.family_updates
for select to authenticated using (public.is_family_member(family_id));

drop policy if exists family_updates_insert_contributor on public.family_updates;
create policy family_updates_insert_contributor on public.family_updates
for insert to authenticated
with check (
  author_user_id = (select auth.uid())
  and public.has_family_role(family_id, array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR'])
);

drop policy if exists family_updates_update_author_or_admin on public.family_updates;
create policy family_updates_update_author_or_admin on public.family_updates
for update to authenticated
using (
  author_user_id = (select auth.uid())
  or public.has_family_role(family_id, array['ADMIN'])
)
with check (
  author_user_id = (select auth.uid())
  or public.has_family_role(family_id, array['ADMIN'])
);

drop policy if exists family_updates_delete_author_or_admin on public.family_updates;
create policy family_updates_delete_author_or_admin on public.family_updates
for delete to authenticated
using (
  author_user_id = (select auth.uid())
  or public.has_family_role(family_id, array['ADMIN'])
);

-- ---------------------------------------------------------------------------
-- Private Storage bucket for medical documents
-- Object naming convention: <family-uuid>/<recipient-uuid>/<filename>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-records',
  'medical-records',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

-- Safely parse the first storage path segment as a family UUID.
create or replace function public.storage_object_family_id(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when (storage.foldername(p_name))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
    else null
  end;
$$;

drop policy if exists medical_records_storage_read on storage.objects;
create policy medical_records_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'medical-records'
  and public.is_family_member(public.storage_object_family_id(name))
);

drop policy if exists medical_records_storage_upload on storage.objects;
create policy medical_records_storage_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'medical-records'
  and public.has_family_role(
    public.storage_object_family_id(name),
    array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']
  )
);

drop policy if exists medical_records_storage_update on storage.objects;
create policy medical_records_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'medical-records'
  and public.has_family_role(
    public.storage_object_family_id(name),
    array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']
  )
)
with check (
  bucket_id = 'medical-records'
  and public.has_family_role(
    public.storage_object_family_id(name),
    array['ADMIN', 'CAREGIVER', 'CONTRIBUTOR']
  )
);

drop policy if exists medical_records_storage_delete on storage.objects;
create policy medical_records_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'medical-records'
  and public.has_family_role(
    public.storage_object_family_id(name),
    array['ADMIN', 'CAREGIVER']
  )
);

commit;
