-- iOS App Factory — Core Schema
-- Run against your Supabase project: supabase db push

-- ── Users (extends Supabase Auth) ──────────────────────────────────────────

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  name          text,
  tier          text not null default 'free' check (tier in ('free', 'premium', 'genius')),
  credits       int not null default 3,
  credits_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Apps ───────────────────────────────────────────────────────────────────

create table if not exists public.apps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade,
  slug          text not null,
  name          text not null,
  description   text,
  design        jsonb,
  style_notes   text,
  status        text not null default 'draft' check (status in ('draft', 'building', 'ready', 'failed')),
  screen_count  int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id, slug)
);

alter table public.apps enable row level security;

create policy "Users can read own apps"
  on public.apps for select using (auth.uid() = user_id);
create policy "Users can insert own apps"
  on public.apps for insert with check (auth.uid() = user_id);
create policy "Users can update own apps"
  on public.apps for update using (auth.uid() = user_id);
create policy "Users can delete own apps"
  on public.apps for delete using (auth.uid() = user_id);

-- ── Builds ─────────────────────────────────────────────────────────────────

create table if not exists public.builds (
  id            uuid primary key default gen_random_uuid(),
  app_id        uuid references public.apps(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  phase         text not null default 'scaffold',
  status        text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  duration_s    real,
  screen_count  int,
  screens_passed int,
  error_message text,
  result        jsonb,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

alter table public.builds enable row level security;

create policy "Users can read own builds"
  on public.builds for select using (auth.uid() = user_id);
create policy "Users can insert own builds"
  on public.builds for insert with check (auth.uid() = user_id);
create policy "Users can update own builds"
  on public.builds for update using (auth.uid() = user_id);

create index idx_builds_user_id on public.builds(user_id);
create index idx_builds_app_id on public.builds(app_id);

-- ── Chat Messages ──────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id            bigint generated always as identity primary key,
  user_id       uuid references public.profiles(id) on delete cascade,
  session_id    uuid not null,
  role          text not null check (role in ('user', 'assistant', 'system')),
  content       text not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can read own messages"
  on public.chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages"
  on public.chat_messages for insert with check (auth.uid() = user_id);

create index idx_chat_user_session on public.chat_messages(user_id, session_id);

-- ── Screenshots (metadata — actual files in Supabase Storage) ──────────────

create table if not exists public.screenshots (
  id            uuid primary key default gen_random_uuid(),
  build_id      uuid references public.builds(id) on delete cascade,
  app_id        uuid references public.apps(id) on delete cascade,
  storage_path  text not null,
  screen_name   text,
  width         int,
  height        int,
  created_at    timestamptz not null default now()
);

alter table public.screenshots enable row level security;

create policy "Users can read own screenshots"
  on public.screenshots for select
  using (exists (select 1 from public.apps where apps.id = screenshots.app_id and apps.user_id = auth.uid()));

-- ── Storage Buckets ────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('app-source', 'app-source', false)
on conflict (id) do nothing;

create policy "Users can upload screenshots"
  on storage.objects for insert
  with check (bucket_id = 'screenshots' and auth.role() = 'authenticated');

create policy "Public can read screenshots"
  on storage.objects for select
  using (bucket_id = 'screenshots');

create policy "Users can upload app source"
  on storage.objects for insert
  with check (bucket_id = 'app-source' and auth.role() = 'authenticated');

create policy "Users can read own app source"
  on storage.objects for select
  using (bucket_id = 'app-source' and auth.role() = 'authenticated');

-- ── Helper: deduct credit ──────────────────────────────────────────────────

create or replace function public.deduct_credit(p_user_id uuid)
returns jsonb as $$
declare
  v_credits int;
  v_tier text;
  v_reset_at timestamptz;
begin
  select credits, tier, credits_reset_at
  into v_credits, v_tier, v_reset_at
  from public.profiles where id = p_user_id for update;

  if v_reset_at <= now() then
    v_credits := case v_tier
      when 'free' then 3
      when 'premium' then 20
      when 'genius' then 100
      else 3
    end;
    v_reset_at := date_trunc('month', now()) + interval '1 month';
    update public.profiles
    set credits = v_credits, credits_reset_at = v_reset_at
    where id = p_user_id;
  end if;

  if v_credits <= 0 then
    return jsonb_build_object('ok', false, 'error', 'No credits remaining', 'tier', v_tier);
  end if;

  update public.profiles set credits = credits - 1 where id = p_user_id;
  return jsonb_build_object('ok', true, 'remaining', v_credits - 1);
end;
$$ language plpgsql security definer;
