-- Let each signed-in user register and remove their own Expo push token.
alter table public.couponly_push_tokens enable row level security;

drop policy if exists couponly_push_tokens_owner on public.couponly_push_tokens;
create policy couponly_push_tokens_owner
  on public.couponly_push_tokens
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
