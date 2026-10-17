drop policy if exists request_admin_delete on public.kouponly_student_requests;
create policy request_admin_delete on public.kouponly_student_requests
  for delete to authenticated
  using (public.kouponly_is_benefits_admin());

grant delete on public.kouponly_student_requests to authenticated;
