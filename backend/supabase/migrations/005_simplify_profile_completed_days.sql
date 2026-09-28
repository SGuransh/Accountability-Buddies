-- Keep only ownership and date in the completed-day summary.
do $$
begin
    if to_regclass('public.profile_completed_days') is not null then
        alter table public.profile_completed_days
            drop column if exists completed_count,
            drop column if exists expected_count,
            drop column if exists created_at,
            drop column if exists updated_at;
    end if;
end;
$$;

drop trigger if exists profile_completed_days_set_updated_at on public.profile_completed_days;
drop function if exists public.set_profile_completed_days_updated_at();
