delete from public.catalogue_partners where id = 'ugc-creator';

drop table if exists public.catalogue_campaigns;
drop table if exists public.campaign_applications;
drop table if exists public.campaign_attachments;
alter table public.user_preferences drop column if exists creator_updates;

drop policy if exists "Users own campaign media" on storage.objects;
