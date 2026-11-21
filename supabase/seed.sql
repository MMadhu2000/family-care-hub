-- The Family Care Hub: synthetic demo seed data.
-- Run only in the development/hackathon project, after the initial migration.
-- Uses the first existing Auth user; it does not create or modify auth credentials.
-- If no Auth user exists, this script safely inserts nothing.

do $$
declare
  v_user_id uuid;
  v_family_id uuid;
  v_recipient_id uuid;
begin
  select id into v_user_id
  from auth.users
  order by created_at asc
  limit 1;

  if v_user_id is null then
    raise notice 'No Auth user exists yet. Sign up first, then rerun seed.sql.';
    return;
  end if;

  select id into v_family_id
  from public.families
  where created_by = v_user_id
    and name = 'DEMO - Family Care Hub'
  limit 1;

  if v_family_id is null then
    insert into public.families (name, created_by)
    values ('DEMO - Family Care Hub', v_user_id)
    returning id into v_family_id;
    -- The family trigger automatically adds this user as ADMIN.
  end if;

  select id into v_recipient_id
  from public.care_recipients
  where family_id = v_family_id
    and full_name = 'Alex Morgan (SYNTHETIC DEMO)'
  limit 1;

  if v_recipient_id is null then
    insert into public.care_recipients (
      family_id, full_name, date_of_birth, notes, created_by
    )
    values (
      v_family_id,
      'Alex Morgan (SYNTHETIC DEMO)',
      date '1948-04-12',
      'Synthetic hackathon demo profile. Not a real person or medical record.',
      v_user_id
    )
    returning id into v_recipient_id;
  end if;

  if not exists (
    select 1 from public.tasks
    where family_id = v_family_id
      and title = 'DEMO: Confirm next routine appointment'
  ) then
    insert into public.tasks (
      family_id, care_recipient_id, title, description, status, priority,
      assigned_to, due_at, created_by
    )
    values (
      v_family_id, v_recipient_id,
      'DEMO: Confirm next routine appointment',
      'Synthetic task for demonstrating family task assignment.',
      'PENDING', 'MEDIUM', v_user_id, now() + interval '3 days', v_user_id
    );
  end if;

  if not exists (
    select 1 from public.appointments
    where family_id = v_family_id
      and title = 'DEMO: Routine check-in'
  ) then
    insert into public.appointments (
      family_id, care_recipient_id, title, provider_name, location,
      scheduled_at, status, notes, created_by
    )
    values (
      v_family_id, v_recipient_id,
      'DEMO: Routine check-in',
      'Example Care Clinic',
      'Demo location',
      now() + interval '7 days',
      'SCHEDULED',
      'Synthetic appointment for UI demonstration only.',
      v_user_id
    );
  end if;

  if not exists (
    select 1 from public.prescriptions
    where family_id = v_family_id
      and care_recipient_id = v_recipient_id
      and medication_name = 'DEMO: Example medication'
  ) then
    insert into public.prescriptions (
      family_id, care_recipient_id, medication_name, dosage,
      instructions, prescribed_by, start_date, active, created_by
    )
    values (
      v_family_id, v_recipient_id,
      'DEMO: Example medication',
      'Example dosage - not medical guidance',
      'Synthetic placeholder. Do not use as treatment advice.',
      'Example clinician',
      current_date,
      true,
      v_user_id
    );
  end if;

  if not exists (
    select 1 from public.timeline_events
    where family_id = v_family_id
      and title = 'DEMO: Family care hub created'
  ) then
    insert into public.timeline_events (
      family_id, care_recipient_id, event_type, title,
      description, occurred_at, created_by
    )
    values (
      v_family_id, v_recipient_id, 'DEMO',
      'DEMO: Family care hub created',
      'Synthetic timeline event for hackathon demonstration.',
      now(), v_user_id
    );
  end if;

  if not exists (
    select 1 from public.family_updates
    where family_id = v_family_id
      and title = 'DEMO: Welcome to the family hub'
  ) then
    insert into public.family_updates (
      family_id, author_user_id, title, body
    )
    values (
      v_family_id, v_user_id,
      'DEMO: Welcome to the family hub',
      'This is synthetic sample content for demonstrating family coordination.'
    );
  end if;

  raise notice 'Synthetic demo records are ready in family %.', v_family_id;
end;
$$;
