revoke insert, update, delete on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;

create policy "Users clear their own notifications" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);
