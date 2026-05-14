-- ════════════════════════════════════════════════════════════
-- Baseline schema — projet Diagnostic Risque Professionnel
--
-- Reconstruit le 2026-05-14 à partir de l'état réel de la base
-- (projet Supabase walwltjkshmizdfptcwl), via le serveur MCP Supabase.
-- Reflète l'état COURANT, incluant déjà :
--   - le correctif de récursion RLS infinie sur profiles
--   - le durcissement sécurité (current_user_role SECURITY DEFINER,
--     search_path figé, EXECUTE restreint, policies en `to authenticated`)
--
-- Couvre : 10 tables, contraintes (PK/FK/UNIQUE/CHECK), RLS + 26 policies,
-- 2 fonctions, 1 trigger. Les grants de tables suivent le défaut Supabase.
-- ════════════════════════════════════════════════════════════


-- ═══════════════════════ Extensions ═══════════════════════
create extension if not exists "uuid-ossp" with schema extensions;


-- ═══════════════════════ Tables ═══════════════════════

create table public.profiles (
  id          uuid not null,
  email       text,
  full_name   text,
  role        text not null default 'broker',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_role_check check (role = any (array['broker'::text, 'underwriter'::text, 'admin'::text]))
);

create table public.sector_profiles (
  id                uuid not null default uuid_generate_v4(),
  sector            text not null,
  label             text not null,
  category_weights  jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint sector_profiles_pkey primary key (id),
  constraint sector_profiles_sector_key unique (sector)
);

create table public.companies (
  id             uuid not null default uuid_generate_v4(),
  name           text not null,
  nace_code      text,
  sector         text,
  employees      integer,
  revenue        numeric,
  city           text,
  country        text default 'France'::text,
  address        text,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  created_by     uuid not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint companies_pkey primary key (id)
);

create table public.diagnostics (
  id            uuid not null default uuid_generate_v4(),
  company_id    uuid not null,
  status        text not null default 'draft'::text,
  global_score  numeric,
  risk_level    text,
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint diagnostics_pkey primary key (id),
  constraint diagnostics_status_check check (status = any (array['draft'::text, 'completed'::text, 'archived'::text])),
  constraint diagnostics_risk_level_check check (risk_level = any (array['low'::text, 'moderate'::text, 'high'::text, 'critical'::text]))
);

create table public.category_scores (
  id             uuid not null default uuid_generate_v4(),
  diagnostic_id  uuid not null,
  category       text not null,
  score          numeric not null default 0,
  risk_level     text,
  weight         numeric not null default 0,
  constraint category_scores_pkey primary key (id),
  constraint category_scores_diagnostic_id_category_key unique (diagnostic_id, category),
  constraint category_scores_category_check check (category = any (array['fire'::text, 'liability'::text, 'dependency'::text, 'equipment'::text, 'cyber'::text, 'fleet'::text])),
  constraint category_scores_risk_level_check check (risk_level = any (array['low'::text, 'moderate'::text, 'high'::text, 'critical'::text]))
);

create table public.offers (
  id             uuid not null default uuid_generate_v4(),
  diagnostic_id  uuid not null,
  type           text not null,
  premium        numeric not null,
  score_used     numeric not null,
  discount_pct   numeric default 0,
  conditions     text,
  created_at     timestamptz not null default now(),
  constraint offers_pkey primary key (id),
  constraint offers_diagnostic_id_type_key unique (diagnostic_id, type),
  constraint offers_type_check check (type = any (array['A'::text, 'B'::text]))
);

create table public.prevention_plans (
  id                     uuid not null default uuid_generate_v4(),
  diagnostic_id          uuid not null,
  status                 text not null default 'draft'::text,
  total_discount_pct     numeric default 0,
  improved_global_score  numeric,
  created_at             timestamptz not null default now(),
  constraint prevention_plans_pkey primary key (id),
  constraint prevention_plans_diagnostic_id_key unique (diagnostic_id),
  constraint prevention_plans_status_check check (status = any (array['draft'::text, 'validated'::text, 'active'::text, 'completed'::text]))
);

create table public.prevention_actions (
  id                   uuid not null default uuid_generate_v4(),
  plan_id              uuid not null,
  category             text not null,
  action_label         text not null,
  description          text,
  score_reduction      numeric not null default 0,
  target_question_key  text,
  deadline_months      integer not null default 12,
  estimated_cost_min   numeric,
  estimated_cost_max   numeric,
  status               text not null default 'pending'::text,
  constraint prevention_actions_pkey primary key (id),
  constraint prevention_actions_category_check check (category = any (array['fire'::text, 'liability'::text, 'dependency'::text, 'equipment'::text, 'cyber'::text, 'fleet'::text])),
  constraint prevention_actions_status_check check (status = any (array['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))
);

create table public.reports (
  id             uuid not null default uuid_generate_v4(),
  diagnostic_id  uuid not null,
  storage_path   text not null,
  file_name      text,
  generated_at   timestamptz not null default now(),
  constraint reports_pkey primary key (id)
);

create table public.risk_answers (
  id             uuid not null default uuid_generate_v4(),
  diagnostic_id  uuid not null,
  category       text not null,
  question_key   text not null,
  answer_value   text not null,
  factor_score   numeric,
  constraint risk_answers_pkey primary key (id),
  constraint risk_answers_diagnostic_id_question_key_key unique (diagnostic_id, question_key),
  constraint risk_answers_category_check check (category = any (array['fire'::text, 'liability'::text, 'dependency'::text, 'equipment'::text, 'cyber'::text, 'fleet'::text]))
);


-- ═══════════════════════ Foreign keys ═══════════════════════
alter table public.profiles            add constraint profiles_id_fkey                 foreign key (id)            references auth.users(id)               on delete cascade;
alter table public.companies           add constraint companies_created_by_fkey        foreign key (created_by)    references public.profiles(id);
alter table public.companies           add constraint companies_sector_fkey            foreign key (sector)        references public.sector_profiles(sector);
alter table public.diagnostics         add constraint diagnostics_company_id_fkey      foreign key (company_id)    references public.companies(id)         on delete cascade;
alter table public.diagnostics         add constraint diagnostics_created_by_fkey      foreign key (created_by)    references public.profiles(id);
alter table public.category_scores     add constraint category_scores_diagnostic_id_fkey   foreign key (diagnostic_id) references public.diagnostics(id)   on delete cascade;
alter table public.offers              add constraint offers_diagnostic_id_fkey        foreign key (diagnostic_id) references public.diagnostics(id)       on delete cascade;
alter table public.prevention_plans    add constraint prevention_plans_diagnostic_id_fkey  foreign key (diagnostic_id) references public.diagnostics(id)   on delete cascade;
alter table public.prevention_actions  add constraint prevention_actions_plan_id_fkey  foreign key (plan_id)       references public.prevention_plans(id)  on delete cascade;
alter table public.reports             add constraint reports_diagnostic_id_fkey       foreign key (diagnostic_id) references public.diagnostics(id)       on delete cascade;
alter table public.risk_answers        add constraint risk_answers_diagnostic_id_fkey  foreign key (diagnostic_id) references public.diagnostics(id)       on delete cascade;


-- ═══════════════════════ Functions ═══════════════════════

-- Lit le rôle de l'utilisateur courant en contournant la RLS (évite la récursion
-- infinie sur les policies de profiles). Exécution réservée aux authentifiés.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke execute on function public.current_user_role() from public, anon;
grant  execute on function public.current_user_role() to authenticated, service_role;

-- Crée la ligne profiles à l'inscription d'un utilisateur (trigger sur auth.users).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'broker')
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant  execute on function public.handle_new_user() to service_role;


-- ═══════════════════════ Triggers ═══════════════════════
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═══════════════════════ Grants (défaut Supabase) ═══════════════════════
grant all on all tables in schema public to anon, authenticated, service_role;


-- ═══════════════════════ Row Level Security ═══════════════════════
alter table public.profiles            enable row level security;
alter table public.sector_profiles     enable row level security;
alter table public.companies           enable row level security;
alter table public.diagnostics         enable row level security;
alter table public.category_scores     enable row level security;
alter table public.offers              enable row level security;
alter table public.prevention_plans    enable row level security;
alter table public.prevention_actions  enable row level security;
alter table public.reports             enable row level security;
alter table public.risk_answers        enable row level security;


-- ═══════════════════════ Policies ═══════════════════════

-- profiles
create policy "Admins and underwriters can view all profiles" on public.profiles
  for select to authenticated
  using ( public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) );
create policy "Users can view own profile" on public.profiles
  for select to public
  using ( auth.uid() = id );
create policy "Users can update own profile" on public.profiles
  for update to public
  using ( auth.uid() = id );

-- sector_profiles
create policy "Authenticated users can read sector profiles" on public.sector_profiles
  for select to public
  using ( auth.role() = 'authenticated'::text );

-- companies
create policy "Authenticated users can create companies" on public.companies
  for insert to public
  with check ( auth.uid() = created_by );
create policy "Brokers see own companies" on public.companies
  for select to public
  using ( created_by = auth.uid() );
create policy "Underwriters see all companies" on public.companies
  for select to authenticated
  using ( public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) );
create policy "Admins can update any company" on public.companies
  for update to authenticated
  using ( public.current_user_role() = 'admin'::text );
create policy "Owners can update companies" on public.companies
  for update to public
  using ( created_by = auth.uid() );

-- diagnostics
create policy "Authenticated users can create diagnostics" on public.diagnostics
  for insert to public
  with check ( auth.uid() = created_by );
create policy "Brokers see own diagnostics" on public.diagnostics
  for select to public
  using ( created_by = auth.uid() );
create policy "Underwriters see all diagnostics" on public.diagnostics
  for select to authenticated
  using ( public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) );
create policy "Owners can update diagnostics" on public.diagnostics
  for update to public
  using ( created_by = auth.uid() );
create policy "Underwriters can update any diagnostic" on public.diagnostics
  for update to authenticated
  using ( public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) );

-- category_scores
create policy "Users can manage category scores" on public.category_scores
  for all to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = category_scores.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
create policy "Users can view category scores" on public.category_scores
  for select to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = category_scores.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );

-- offers
create policy "Users can manage offers" on public.offers
  for all to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = offers.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
create policy "Users can view offers" on public.offers
  for select to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = offers.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );

-- prevention_plans
create policy "Users can manage prevention plans" on public.prevention_plans
  for all to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = prevention_plans.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
create policy "Users can view prevention plans" on public.prevention_plans
  for select to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = prevention_plans.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );

-- prevention_actions
create policy "Users can manage prevention actions" on public.prevention_actions
  for all to authenticated
  using ( exists ( select 1 from public.prevention_plans pp
    join public.diagnostics d on d.id = pp.diagnostic_id
    where pp.id = prevention_actions.plan_id
      and ( d.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
create policy "Users can view prevention actions" on public.prevention_actions
  for select to authenticated
  using ( exists ( select 1 from public.prevention_plans pp
    join public.diagnostics d on d.id = pp.diagnostic_id
    where pp.id = prevention_actions.plan_id
      and ( d.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );

-- reports
create policy "Users can manage reports" on public.reports
  for all to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = reports.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
create policy "Users can view reports" on public.reports
  for select to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = reports.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );

-- risk_answers
create policy "Users can manage risk answers" on public.risk_answers
  for all to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = risk_answers.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
create policy "Users can view risk answers" on public.risk_answers
  for select to authenticated
  using ( exists ( select 1 from public.diagnostics
    where diagnostics.id = risk_answers.diagnostic_id
      and ( diagnostics.created_by = auth.uid()
            or public.current_user_role() = any (array['admin'::text, 'underwriter'::text]) ) ) );
