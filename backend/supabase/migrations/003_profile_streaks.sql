-- Persist the user's all-habits streak and its historical best.
alter table public.profiles
    add column if not exists current_streak integer not null default 0,
    add column if not exists personal_best integer not null default 0;

alter table public.profiles
    drop constraint if exists profiles_current_streak_check,
    drop constraint if exists profiles_personal_best_check;

alter table public.profiles
    add constraint profiles_current_streak_check check (current_streak >= 0),
    add constraint profiles_personal_best_check check (personal_best >= 0);
