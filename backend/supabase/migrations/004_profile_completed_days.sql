-- Materialized daily summary for calendar reads.
create table if not exists public.profile_completed_days (
    profile_id uuid not null references public.profiles(id) on delete cascade,
    completion_date date not null,
    primary key (profile_id, completion_date)
);

create index if not exists profile_completed_days_date_idx
    on public.profile_completed_days(profile_id, completion_date);

alter table public.profile_completed_days enable row level security;

drop policy if exists profile_completed_days_select_own on public.profile_completed_days;
create policy profile_completed_days_select_own
on public.profile_completed_days for select
to authenticated
using (profile_id = (select auth.uid()));
