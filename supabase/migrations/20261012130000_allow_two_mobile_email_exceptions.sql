-- Allow two explicitly approved mobile accounts outside the Rajagiri domain.
-- Signup and free membership still require verified ownership of the email.
create or replace function public.kouponly_school_email(p_email text)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(
    lower(trim(p_email)) ~ '^[^@[:space:]]+@rajagiri[.]edu[.]in$'
    or lower(trim(p_email)) = any(array[
      'info@kouponly.in',
      'pauljasonthykatt@gmail.com',
      'sabinjsshaji2002@gmail.com'
    ]),
    false
  );
$$;
