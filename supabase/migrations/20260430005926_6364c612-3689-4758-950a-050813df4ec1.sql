-- 1) Project category
alter table public.projects
  add column if not exists category text;

create index if not exists idx_projects_category on public.projects(category);

-- 2) Dynamic permissions system
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label_ar text not null,
  label_en text not null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role app_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  unique(role, permission_key)
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, permission_key)
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;

-- Policies: read for all authenticated; write for executive only
DROP POLICY IF EXISTS permissions_select ON public.permissions;
create policy permissions_select on public.permissions for select to authenticated using (true);
DROP POLICY IF EXISTS permissions_write ON public.permissions;
create policy permissions_write on public.permissions for all to authenticated
  using (public.has_role(auth.uid(),'executive')) with check (public.has_role(auth.uid(),'executive'));

DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.has_role(auth.uid(),'executive')) with check (public.has_role(auth.uid(),'executive'));

DROP POLICY IF EXISTS user_permissions_select ON public.user_permissions;
create policy user_permissions_select on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['executive','assistant']::app_role[]));
DROP POLICY IF EXISTS user_permissions_write ON public.user_permissions;
create policy user_permissions_write on public.user_permissions for all to authenticated
  using (public.has_role(auth.uid(),'executive')) with check (public.has_role(auth.uid(),'executive'));

-- Helper function
create or replace function public.user_has_permission(_user_id uuid, _permission_key text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    coalesce((select granted from public.user_permissions where user_id = _user_id and permission_key = _permission_key), false)
    or exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
      where ur.user_id = _user_id and rp.permission_key = _permission_key
    )
$$;

-- Seed default permissions
insert into public.permissions (key, label_ar, label_en, category) values
  ('view_dashboard', 'عرض لوحة التحكم', 'View Dashboard', 'general'),
  ('view_projects', 'عرض المشاريع', 'View Projects', 'projects'),
  ('manage_projects', 'إدارة المشاريع', 'Manage Projects', 'projects'),
  ('view_tasks', 'عرض المهام', 'View Tasks', 'tasks'),
  ('manage_tasks', 'إدارة المهام', 'Manage Tasks', 'tasks'),
  ('view_participants', 'عرض المشاركين', 'View Participants', 'participants'),
  ('manage_participants', 'إدارة المشاركين', 'Manage Participants', 'participants'),
  ('view_attendance', 'عرض الحضور', 'View Attendance', 'attendance'),
  ('manage_attendance', 'إدارة الحضور', 'Manage Attendance', 'attendance'),
  ('view_finance', 'عرض المالية', 'View Finance', 'finance'),
  ('manage_finance', 'إدارة المالية', 'Manage Finance', 'finance'),
  ('view_reports', 'عرض التقارير', 'View Reports', 'reports'),
  ('view_notifications', 'عرض الإشعارات', 'View Notifications', 'notifications'),
  ('send_notifications', 'إرسال الإشعارات', 'Send Notifications', 'notifications'),
  ('manage_users', 'إدارة المستخدمين', 'Manage Users', 'admin'),
  ('manage_permissions', 'إدارة الصلاحيات', 'Manage Permissions', 'admin'),
  ('view_audit', 'عرض سجل العمليات', 'View Audit Log', 'admin')
on conflict (key) do nothing;

-- Seed default role-permission mappings
insert into public.role_permissions (role, permission_key)
select 'executive'::app_role, key from public.permissions
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('assistant', 'view_dashboard'),('assistant', 'view_projects'),('assistant', 'manage_projects'),
  ('assistant', 'view_tasks'),('assistant', 'manage_tasks'),('assistant', 'view_participants'),
  ('assistant', 'manage_participants'),('assistant', 'view_attendance'),('assistant', 'manage_attendance'),
  ('assistant', 'view_finance'),('assistant', 'manage_finance'),('assistant', 'view_reports'),
  ('assistant', 'view_notifications'),('assistant', 'send_notifications'),('assistant', 'view_audit'),
  ('board', 'view_dashboard'),('board', 'view_projects'),('board', 'view_tasks'),
  ('board', 'view_participants'),('board', 'view_attendance'),('board', 'view_finance'),
  ('board', 'view_reports'),('board', 'view_notifications'),('board', 'view_audit'),
  ('project_manager', 'view_dashboard'),('project_manager', 'view_projects'),
  ('project_manager', 'view_tasks'),('project_manager', 'manage_tasks'),
  ('project_manager', 'view_participants'),('project_manager', 'manage_participants'),
  ('project_manager', 'view_attendance'),('project_manager', 'manage_attendance'),
  ('project_manager', 'view_finance'),('project_manager', 'send_notifications'),
  ('branch_manager', 'view_dashboard'),('branch_manager', 'view_projects'),
  ('branch_manager', 'view_tasks'),('branch_manager', 'view_participants'),
  ('branch_manager', 'view_attendance'),('branch_manager', 'manage_attendance'),
  ('branch_manager', 'send_notifications'),
  ('employee', 'view_dashboard'),('employee', 'view_tasks')
on conflict do nothing;

-- 3) External staff registration requests
create type public.staff_request_status as enum ('pending','approved','rejected');

create table if not exists public.staff_registration_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  national_id text,
  requested_role app_role not null default 'employee',
  notes text,
  status staff_request_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.staff_registration_requests enable row level security;

-- Public can insert (no auth needed) — public registration form
DROP POLICY IF EXISTS staff_req_public_insert ON public.staff_registration_requests;
create policy staff_req_public_insert on public.staff_registration_requests
  for insert to anon, authenticated
  with check (status = 'pending');

DROP POLICY IF EXISTS staff_req_admin_select ON public.staff_registration_requests;
create policy staff_req_admin_select on public.staff_registration_requests
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['executive','assistant']::app_role[]));

DROP POLICY IF EXISTS staff_req_admin_update ON public.staff_registration_requests;
create policy staff_req_admin_update on public.staff_registration_requests
  for update to authenticated
  using (public.has_any_role(auth.uid(), array['executive','assistant']::app_role[]));

DROP POLICY IF EXISTS staff_req_admin_delete ON public.staff_registration_requests;
create policy staff_req_admin_delete on public.staff_registration_requests
  for delete to authenticated
  using (public.has_role(auth.uid(),'executive'));

create index if not exists idx_staff_req_status on public.staff_registration_requests(status);