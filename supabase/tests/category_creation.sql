-- Run against an initialized database with an admin account. All writes roll back.
begin;
set local plpgsql.check_asserts = on;
do $$
declare admin_id uuid;
begin
  select user_id into strict admin_id
  from public.couponly_user_roles where role = 'admin' order by user_id limit 1;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
end $$;
set local role authenticated;
do $$
declare
  created_category_id text;
  category_slug text := 'category-test-' || gen_random_uuid();
begin
  insert into public.couponly_categories(name,slug,image_path,sort_order,active)
  values ('Category creation test',category_slug,null,999,true)
  returning id into created_category_id;
  assert created_category_id is not null, 'An admin must be able to create a category with no image or subcategories';

  update public.couponly_categories
  set payload = '{"subcategories":[{"nameEnglish":"Test subcategory"}]}'
  where id = created_category_id;
  assert exists (
    select 1 from public.couponly_subcategories where id = created_category_id || ':test-subcategory'
  ), 'A new category must support adding subcategories';

  update public.couponly_categories
  set payload = jsonb_build_object('subcategories', jsonb_build_array(
    jsonb_build_object('id', created_category_id || ':test-subcategory', 'nameEnglish', 'Renamed subcategory', 'slug', 'renamed-subcategory'),
    jsonb_build_object('id', created_category_id || ':replacement', 'nameEnglish', 'Test subcategory', 'slug', 'test-subcategory')
  ))
  where id = created_category_id;
  assert exists (
    select 1 from public.couponly_subcategories
    where id = created_category_id || ':test-subcategory' and slug = 'renamed-subcategory'
  ), 'Renaming must preserve the subcategory ID and release its old slug';
  assert exists (
    select 1 from public.couponly_subcategories
    where id = created_category_id || ':replacement' and slug = 'test-subcategory' and sort_order = 1
  ), 'Another subcategory must be able to use the old name';

  update public.couponly_categories set sort_order = 998 where id = created_category_id;
  assert (select sort_order = 998 from public.couponly_categories where id = created_category_id),
    'An admin must be able to save category sorting';
end $$;
rollback;
