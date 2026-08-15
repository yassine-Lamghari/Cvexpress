create extension if not exists pgcrypto;

create table if not exists public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  job_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid null references public.cvs(id) on delete set null,
  bucket text not null,
  object_key text unique,
  filename text not null,
  content_type text not null default 'application/pdf',
  size_bytes bigint,
  checksum_sha256 text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.storage_objects
  add column if not exists progress integer not null default 0;

alter table public.storage_objects
  drop constraint if exists storage_objects_progress_check;

alter table public.storage_objects
  add constraint storage_objects_progress_check check (progress between 0 and 100);

create index if not exists storage_objects_user_id_idx
  on public.storage_objects(user_id);

create index if not exists storage_objects_cv_id_idx
  on public.storage_objects(cv_id);

create index if not exists storage_objects_status_idx
  on public.storage_objects(status);

create or replace function public.set_storage_objects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists storage_objects_updated_at on public.storage_objects;
create trigger storage_objects_updated_at
before update on public.storage_objects
for each row execute function public.set_storage_objects_updated_at();

alter table public.storage_objects enable row level security;

grant select, insert, delete on public.storage_objects to authenticated;

drop policy if exists "Users read their own storage objects" on public.storage_objects;
create policy "Users read their own storage objects"
on public.storage_objects
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own storage jobs" on public.storage_objects;
create policy "Users create their own storage jobs"
on public.storage_objects
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'queued'
  and object_key is null
  and (
    cv_id is null
    or exists (
      select 1 from public.cvs
      where cvs.id = storage_objects.cv_id
        and cvs.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users delete queued storage jobs" on public.storage_objects;
create policy "Users delete queued storage jobs"
on public.storage_objects
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'queued'
  and object_key is null
);
