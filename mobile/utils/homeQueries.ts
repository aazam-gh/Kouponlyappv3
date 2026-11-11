import { queryOptions } from '@tanstack/react-query';
import { getPublicSupabase, getSupabase } from '@/lib/supabase';
import { fetchCloudCatalogue } from '@/lib/backend';
import { normalizeHomeSectionOrder } from '@/lib/home-layout';
import { safeWebUrl } from '@/lib/vendor-links';
import { queryClient, queryKeys } from './queryClient';
export type HomeLocale='en';
export type HomeCategoryItem={id:string;name:string;englishName?:string;image?:string|number;icon?:string};
export type HomeBannerItem={bannerId:string;altText:string;id?:string;images:{desktop?:string;mobile?:string};isActive:boolean;vendorId?:string;vendorIds?:string[];mobileDimensions?:{width:number;height:number}};
export type HomeFeaturedBannerItem={id:string;vendorId?:string;title?:string;imageUrl?:string;heroImageUrl?:string;orderUrl?:string;imagePositionY?:number;ctaText?:string;isActive?:boolean;order?:number};
export type HomeBrandItem={id:string;name:string;logoUrl:string;vendorId:string;isActive:boolean};
export type HomeOfferCard={id:string;vendorId:string;nameEn?:string;vendorName?:string;shortDescription?:string;brandDescription?:string;descriptionEn?:string;bannerImage?:string;coverImage?:string;vendorProfilePicture?:string;profilePicture?:string;isTrending?:boolean;xcard?:boolean;[key:string]:any};
export const isValidHomeFeaturedBanner=(row:HomeFeaturedBannerItem)=>Boolean(row?.id&&(row?.vendorId||row?.orderUrl)&&row?.isActive!==false&&(row?.imageUrl||row?.heroImageUrl));
const catalogue=()=>queryClient.fetchQuery({queryKey:queryKeys.catalogueHome(),queryFn:fetchCloudCatalogue});
const vendorCards=async()=>{const catalog=await catalogue();return catalog.deals.map(deal=>({id:String(deal.vendorId||deal.id),vendorId:String(deal.vendorId||deal.id),nameEn:deal.name,vendorName:deal.name,shortDescription:deal.description,bannerImage:deal.image,coverImage:deal.image,vendorProfilePicture:deal.logo,profilePicture:deal.logo,xcard:deal.xcard,cardLabel:deal.cardLabel,newest:deal.newest,trend:deal.trend,isTrending:deal.trend>0} as HomeOfferCard))};
const cms=async<T>(id:string)=>{const {data,error}=await getSupabase().from('kouponly_cms_documents').select('payload').eq('id',id).maybeSingle();if(error)throw error;return (data?.payload||{}) as T};

async function readHome<T>(query: (signal: AbortSignal) => PromiseLike<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try { return await query(controller.signal); }
  finally { clearTimeout(timeout); }
}

const feedUrl = process.env.EXPO_PUBLIC_HOME_FEED_URL?.trim();
let feedRequest: Promise<{ categories: HomeCategoryItem[]; order: unknown; banners: unknown }> | undefined;

function readPublicHomeFeed() {
  if (!feedUrl) return Promise.resolve(undefined);
  return feedRequest ??= (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(feedUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('Home feed unavailable');
      const feed = await response.json();
      if (feed?.version !== 1 || !Array.isArray(feed.categories) || !Array.isArray(feed.banners)
        || (feed.order !== null && !Array.isArray(feed.order))
        || !feed.categories.every((row: HomeCategoryItem) => typeof row?.id === 'string' && typeof row.name === 'string')) {
        throw new Error('Invalid Home feed');
      }
      return feed;
    } finally { clearTimeout(timeout); }
  })().finally(() => { feedRequest = undefined; });
}

async function fetchHomeCategories(): Promise<HomeCategoryItem[]> {
  const feed = await readPublicHomeFeed().catch(() => undefined);
  if (feed) return feed.categories;
  const { data, error } = await readHome(signal => getPublicSupabase().from('kouponly_categories')
    .select('id,name,image_path,english_name:payload->>nameEnglish,icon:payload->>icon')
    .eq('active', true).order('sort_order').abortSignal(signal));
  if (error) throw error;
  return (data ?? []).map(row => {
    const name = row.english_name || row.name;
    return { id: String(row.id), name, englishName: name, image: row.image_path || undefined, icon: row.icon || 'ShoppingBag' };
  });
}

async function fetchHomeEditorial() {
  const feed = await readPublicHomeFeed().catch(() => undefined);
  if (feed) return { order: normalizeHomeSectionOrder(feed.order), banners: readHomeBanners(feed.banners) };
  const { data, error } = await readHome(signal => getPublicSupabase().from('kouponly_cms_documents')
    .select('id,payload').in('id', ['banner', 'homeLayout']).abortSignal(signal));
  if (error) throw error;
  const layout = data?.find(row => row.id === 'homeLayout')?.payload;
  return {
    order: normalizeHomeSectionOrder(layout?.enabledSections ?? layout?.sectionOrder),
    banners: readHomeBanners(data?.find(row => row.id === 'banner')?.payload?.banners),
  };
}

export function readHomeBanners(value: unknown): HomeBannerItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row: Partial<HomeBannerItem> | null) => {
    if (row?.isActive !== true) return [];
    const mobile = typeof row.images?.mobile === 'string' ? safeWebUrl(row.images.mobile) : undefined;
    const desktop = typeof row.images?.desktop === 'string' ? safeWebUrl(row.images.desktop) : undefined;
    if (!mobile && !desktop) return [];
    return [{
      bannerId: typeof row.bannerId === 'string' ? row.bannerId : '',
      altText: typeof row.altText === 'string' ? row.altText : '',
      id: typeof row.id === 'string' ? row.id : undefined,
      vendorId: typeof row.vendorId === 'string' ? row.vendorId : undefined,
      vendorIds: Array.isArray(row.vendorIds) ? row.vendorIds.filter(id => typeof id === 'string') : undefined,
      images: { mobile: mobile || undefined, desktop: desktop || undefined },
      mobileDimensions: row.mobileDimensions && row.mobileDimensions.width > 0 && row.mobileDimensions.height > 0
        ? row.mobileDimensions : undefined,
      isActive: true,
    }];
  });
}

export async function fetchBannerVendorNames(ids: string[]) {
  const { data, error } = await getPublicSupabase().from('kouponly_vendors')
    .select('id,name').eq('status', 'Active').in('id', ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(row => [String(row.id), String(row.name)]));
}

export type HomePreviewCard = { id: string; vendorId: string; name: string; image?: string; logo?: string; xcard?: boolean; cardLabel?: string };
type HomePreviews = { newDeals: HomePreviewCard[]; trending: HomePreviewCard[]; brands: HomeBrandItem[] };

async function fetchHomePreviews(): Promise<HomePreviews> {
  const { data, error } = await readHome(signal => getPublicSupabase().rpc('kouponly_home_preview_cards').abortSignal(signal));
  if (error) throw error;
  if (!Array.isArray(data?.newDeals) || !Array.isArray(data.trending) || !Array.isArray(data.brands)) {
    throw new Error('Invalid Home previews');
  }
  return data;
}

export const homeQueryOptions={
 previews:()=>queryOptions({ queryKey: ['home-previews'] as const, queryFn: fetchHomePreviews, staleTime: 30_000, refetchInterval: 60_000, refetchOnMount: true, retry: false }),
 categories:(locale:HomeLocale)=>queryOptions({queryKey:queryKeys.categories(locale),queryFn:fetchHomeCategories,retry:false}),
 editorial:()=>queryOptions({queryKey:queryKeys.homeEditorial(),queryFn:fetchHomeEditorial,retry:false}),
 offers:()=>queryOptions<HomeOfferCard[]>({queryKey:queryKeys.trendingOffers(),queryFn:async()=>vendorCards().then(cards=>cards.filter(card=>Number(card.trend)>0).sort((a,b)=>Number(a.trend)-Number(b.trend)||String(a.vendorName).localeCompare(String(b.vendorName))))}),
 featuredBanner:()=>queryOptions<HomeFeaturedBannerItem[]>({queryKey:queryKeys.cmsDocument('featuredBrandShowcase'),queryFn:async()=>{const result=await cms<{items?:HomeFeaturedBannerItem[]}>('featuredBrandShowcase');return (result.items||[]).filter(isValidHomeFeaturedBanner).sort((a,b)=>(a.order||0)-(b.order||0))}}),
 brands:()=>queryOptions<HomeBrandItem[]>({queryKey:queryKeys.cmsDocument('brand'),queryFn:async()=>{const result=await cms<{brands?:HomeBrandItem[]}>('brand');const catalog=await catalogue();return (result.brands||[]).flatMap(row=>{const deal=catalog.deals.find(deal=>deal.vendorId===row.vendorId);return row.isActive&&deal?[{...row,name:deal.name,logoUrl:row.logoUrl||deal.logo||''}]:[]})}}),
};
