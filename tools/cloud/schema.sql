-- ShiHanzi accounts and sync (v4.47). Run once in the Supabase SQL editor.
-- One row per account: the app's whole save (db) as JSON. rev counts uploads; the app only
-- updates a row whose rev is the one it last saw, so two devices never overwrite each other blind.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  rev        bigint not null default 1,
  device     text,
  updated_at timestamptz not null default now()
);

-- keep updated_at true, whatever the app sends
create or replace function public.saves_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before insert or update on public.saves for each row execute function public.saves_touch();

-- every account sees and changes only its own row
alter table public.saves enable row level security;
drop policy if exists "read own save" on public.saves;
drop policy if exists "add own save" on public.saves;
drop policy if exists "change own save" on public.saves;
create policy "read own save"   on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own save"    on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own save" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

-- "Delete account" in the app: removes the signed-in account (its save goes with it, on delete cascade)
create or replace function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- a save may be at most 5 MB, so one account can't fill the free plan's 500 MB
alter table public.saves drop constraint if exists saves_size;
alter table public.saves add constraint saves_size check (pg_column_size(data) < 5000000);
