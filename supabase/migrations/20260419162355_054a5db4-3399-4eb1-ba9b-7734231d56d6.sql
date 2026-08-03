-- ENUMS
create type public.app_role as enum ('board','executive','assistant','project_manager','branch_manager','employee','contractor','participant','guardian');
create type public.project_status as enum ('planned','in_progress','completed','stalled');
create type public.task_status as enum ('new','in_progress','completed','overdue');
create type public.task_priority as enum ('low','medium','high','urgent');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, phone text, email text, avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles));
$$;

create or replace function public.get_user_roles(_user_id uuid)
returns setof public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = _user_id;
$$;

-- PROJECTS
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null, name_en text, description text,
  manager_id uuid references auth.users(id) on delete set null,
  has_branches boolean not null default false,
  status public.project_status not null default 'planned',
  budget numeric(14,2) default 0,
  start_date date, end_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;

-- BRANCHES
create table public.project_branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name_ar text not null, name_en text,
  branch_manager_id uuid references auth.users(id) on delete set null,
  status public.project_status not null default 'planned',
  start_date date, end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_branches enable row level security;

-- MEMBERS
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.project_branches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_id, branch_id, user_id)
);
alter table public.project_members enable row level security;

create or replace function public.can_access_project(_user_id uuid, _project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_any_role(_user_id, array['executive','assistant','board']::public.app_role[])
    or exists (select 1 from public.projects p where p.id = _project_id and p.manager_id = _user_id)
    or exists (select 1 from public.project_members m where m.project_id = _project_id and m.user_id = _user_id)
    or exists (select 1 from public.project_branches b where b.project_id = _project_id and b.branch_manager_id = _user_id);
$$;

create or replace function public.can_access_branch(_user_id uuid, _branch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_any_role(_user_id, array['executive','assistant','board']::public.app_role[])
    or exists (
      select 1 from public.project_branches b join public.projects p on p.id = b.project_id
      where b.id = _branch_id and (b.branch_manager_id = _user_id or p.manager_id = _user_id)
    )
    or exists (select 1 from public.project_members m where m.branch_id = _branch_id and m.user_id = _user_id);
$$;

-- TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.project_branches(id) on delete set null,
  title text not null, description text,
  assignee_id uuid references auth.users(id) on delete set null,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'new',
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.task_comments enable row level security;

-- AUDIT
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

-- TIMESTAMP TRIGGER
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_branches_updated before update on public.project_branches for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks for each row execute function public.set_updated_at();

-- AUTO PROFILE + DEFAULT ROLE
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _is_first boolean;
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, new.raw_user_meta_data->>'phone');
  select count(*) = 0 into _is_first from public.user_roles;
  if _is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'executive');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'employee');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- POLICIES
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles for select
  using (auth.uid() = id or public.has_any_role(auth.uid(), array['executive','assistant','board']::public.app_role[]));
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
create policy "profiles_update_admin" on public.profiles for update using (public.has_role(auth.uid(),'executive'));

DROP POLICY IF EXISTS "roles_select_self_or_admin" ON public.user_roles;
create policy "roles_select_self_or_admin" on public.user_roles for select
  using (auth.uid() = user_id or public.has_any_role(auth.uid(), array['executive','assistant','board']::public.app_role[]));
DROP POLICY IF EXISTS "roles_insert_admin" ON public.user_roles;
create policy "roles_insert_admin" on public.user_roles for insert with check (public.has_role(auth.uid(),'executive'));
DROP POLICY IF EXISTS "roles_update_admin" ON public.user_roles;
create policy "roles_update_admin" on public.user_roles for update using (public.has_role(auth.uid(),'executive'));
DROP POLICY IF EXISTS "roles_delete_admin" ON public.user_roles;
create policy "roles_delete_admin" on public.user_roles for delete using (public.has_role(auth.uid(),'executive'));

DROP POLICY IF EXISTS "projects_select" ON public.projects;
create policy "projects_select" on public.projects for select using (public.can_access_project(auth.uid(), id));
DROP POLICY IF EXISTS "projects_insert_admin" ON public.projects;
create policy "projects_insert_admin" on public.projects for insert with check (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[]));
DROP POLICY IF EXISTS "projects_update" ON public.projects;
create policy "projects_update" on public.projects for update using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[]) or manager_id = auth.uid());
DROP POLICY IF EXISTS "projects_delete_admin" ON public.projects;
create policy "projects_delete_admin" on public.projects for delete using (public.has_role(auth.uid(),'executive'));

DROP POLICY IF EXISTS "branches_select" ON public.project_branches;
create policy "branches_select" on public.project_branches for select using (public.can_access_branch(auth.uid(), id));
DROP POLICY IF EXISTS "branches_insert" ON public.project_branches;
create policy "branches_insert" on public.project_branches for insert with check (
  public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
  or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
);
DROP POLICY IF EXISTS "branches_update" ON public.project_branches;
create policy "branches_update" on public.project_branches for update using (
  public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
  or branch_manager_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
);
DROP POLICY IF EXISTS "branches_delete" ON public.project_branches;
create policy "branches_delete" on public.project_branches for delete using (
  public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
  or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "members_select" ON public.project_members;
create policy "members_select" on public.project_members for select using (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "members_write" ON public.project_members;
create policy "members_write" on public.project_members for all
  using (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid()))
  with check (public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid()));

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
create policy "tasks_select" on public.tasks for select using (assignee_id = auth.uid() or public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
create policy "tasks_insert" on public.tasks for insert with check (public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
create policy "tasks_update" on public.tasks for update using (assignee_id = auth.uid() or public.can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
create policy "tasks_delete" on public.tasks for delete using (
  public.has_any_role(auth.uid(), array['executive','assistant']::public.app_role[])
  or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "comments_select" ON public.task_comments;
create policy "comments_select" on public.task_comments for select using (
  exists (select 1 from public.tasks t where t.id = task_id
    and (t.assignee_id = auth.uid() or public.can_access_project(auth.uid(), t.project_id)))
);
DROP POLICY IF EXISTS "comments_insert" ON public.task_comments;
create policy "comments_insert" on public.task_comments for insert with check (
  user_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id
    and (t.assignee_id = auth.uid() or public.can_access_project(auth.uid(), t.project_id)))
);
DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.task_comments;
create policy "comments_delete_own_or_admin" on public.task_comments for delete using (user_id = auth.uid() or public.has_role(auth.uid(),'executive'));

DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_log;
create policy "audit_select_admin" on public.audit_log for select using (public.has_any_role(auth.uid(), array['executive','assistant','board']::public.app_role[]));
DROP POLICY IF EXISTS "audit_insert_self" ON public.audit_log;
create policy "audit_insert_self" on public.audit_log for insert with check (user_id = auth.uid());