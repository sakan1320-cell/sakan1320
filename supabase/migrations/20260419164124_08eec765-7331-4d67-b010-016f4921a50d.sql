
-- Enums
create type public.attendance_subject_type as enum ('employee','participant');
create type public.attendance_status as enum ('present','absent','late','excused');
create type public.notification_channel as enum ('whatsapp','sms','email');
create type public.notification_status as enum ('pending','sent','failed');
create type public.notification_template as enum ('absence','late','reminder','task','manual');
create type public.guardian_relation as enum ('father','mother','guardian','other');
create type public.participant_status as enum ('active','inactive');
create type public.gender as enum ('male','female');

-- Guardians
create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  national_id text,
  relation public.guardian_relation not null default 'guardian',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_guardians_phone on public.guardians(phone);

-- Participants
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date,
  gender public.gender,
  national_id text,
  phone text,
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.project_branches(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  status public.participant_status not null default 'active',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_participants_project on public.participants(project_id);
create index idx_participants_branch on public.participants(branch_id);
create index idx_participants_guardian on public.participants(guardian_id);

-- Attendance
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  subject_type public.attendance_subject_type not null,
  subject_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.project_branches(id) on delete set null,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status not null default 'present',
  notes text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, date)
);
create index idx_attendance_project_date on public.attendance(project_id, date);
create index idx_attendance_branch_date on public.attendance(branch_id, date);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  channel public.notification_channel not null default 'whatsapp',
  recipient_phone text,
  recipient_email text,
  recipient_name text,
  subject text,
  body text not null,
  template public.notification_template not null default 'manual',
  related_entity_type text,
  related_entity_id uuid,
  status public.notification_status not null default 'pending',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index idx_notifications_created_at on public.notifications(created_at desc);

-- Updated_at triggers
create trigger trg_guardians_updated before update on public.guardians for each row execute function public.set_updated_at();
create trigger trg_participants_updated before update on public.participants for each row execute function public.set_updated_at();

-- Helper: can manage guardians (admins or managers tied to a participant of theirs)
create or replace function public.can_manage_guardian(_user_id uuid, _guardian_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(_user_id, array['executive','assistant']::public.app_role[])
    or exists (
      select 1 from public.participants pa
      join public.projects p on p.id = pa.project_id
      left join public.project_branches b on b.id = pa.branch_id
      where pa.guardian_id = _guardian_id
        and (p.manager_id = _user_id or b.branch_manager_id = _user_id)
    );
$$;

-- RLS
alter table public.guardians enable row level security;
alter table public.participants enable row level security;
alter table public.attendance enable row level security;
alter table public.notifications enable row level security;

-- Guardians policies
DROP POLICY IF EXISTS guardians_select ON public.guardians;
create policy guardians_select on public.guardians for select
  using (public.has_any_role(auth.uid(), array['executive','assistant','board','project_manager','branch_manager']::public.app_role[])
    or public.can_manage_guardian(auth.uid(), id));
DROP POLICY IF EXISTS guardians_insert ON public.guardians;
create policy guardians_insert on public.guardians for insert
  with check (public.has_any_role(auth.uid(), array['executive','assistant','project_manager','branch_manager']::public.app_role[]));
DROP POLICY IF EXISTS guardians_update ON public.guardians;
create policy guardians_update on public.guardians for update
  using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[]) or public.can_manage_guardian(auth.uid(), id));
DROP POLICY IF EXISTS guardians_delete ON public.guardians;
create policy guardians_delete on public.guardians for delete
  using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[]));

-- Participants policies
DROP POLICY IF EXISTS participants_select ON public.participants;
create policy participants_select on public.participants for select
  using (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS participants_insert ON public.participants;
create policy participants_insert on public.participants for insert
  with check (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS participants_update ON public.participants;
create policy participants_update on public.participants for update
  using (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS participants_delete ON public.participants;
create policy participants_delete on public.participants for delete
  using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
    or exists (select 1 from public.projects p where p.id = participants.project_id and p.manager_id = auth.uid()));

-- Attendance policies
DROP POLICY IF EXISTS attendance_select ON public.attendance;
create policy attendance_select on public.attendance for select
  using (public.can_access_project(auth.uid(), project_id)
    or (subject_type = 'employee' and subject_id = auth.uid()));
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
create policy attendance_insert on public.attendance for insert
  with check (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS attendance_update ON public.attendance;
create policy attendance_update on public.attendance for update
  using (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS attendance_delete ON public.attendance;
create policy attendance_delete on public.attendance for delete
  using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
    or exists (select 1 from public.projects p where p.id = attendance.project_id and p.manager_id = auth.uid()));

-- Notifications policies
DROP POLICY IF EXISTS notifications_select ON public.notifications;
create policy notifications_select on public.notifications for select
  using (public.has_any_role(auth.uid(), array['executive','assistant','board']::public.app_role[]));
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (public.has_any_role(auth.uid(), array['executive','assistant','project_manager','branch_manager']::public.app_role[]));
DROP POLICY IF EXISTS notifications_update ON public.notifications;
create policy notifications_update on public.notifications for update
  using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[]));
