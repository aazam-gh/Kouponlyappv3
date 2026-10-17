import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';
import { fetchCloudCatalogue } from '@/lib/backend';
import { queryClient, queryKeys } from './queryClient';
export type HomeLocale='en';
export type HomeCategoryItem={id:string;name:string;englishName?:string;image?:string|number;icon?:string};
export type HomeBannerItem={bannerId:string;altText:string;id?:string;images:{desktop?:string;mobile?:string};isActive:boolean;vendorId?:string;vendorIds?:string[];vendorNames?:Record<string,string>;lastUpdated?:string};
export type HomeFeaturedBannerItem={id:string;vendorId?:string;title?:string;imageUrl?:string;heroImageUrl?:string;orderUrl?:string;imagePositionY?:number;ctaText?:string;isActive?:boolean;order?:number};
export type HomeBrandItem={id:string;name:string;logoUrl:string;vendorId:string;isActive:boolean};
export type HomeOfferCard={id:string;vendorId:string;nameEn?:string;vendorName?:string;shortDescription?:string;brandDescription?:string;descriptionEn?:string;bannerImage?:string;coverImage?:string;vendorProfilePicture?:string;profilePicture?:string;isTrending?:boolean;xcard?:boolean;[key:string]:any};
export const isValidHomeFeaturedBanner=(row:HomeFeaturedBannerItem)=>Boolean(row?.id&&(row?.vendorId||row?.orderUrl)&&row?.isActive!==false&&(row?.imageUrl||row?.heroImageUrl));
const catalogue=()=>queryClient.fetchQuery({queryKey:queryKeys.catalogueHome(),queryFn:fetchCloudCatalogue});
const vendorCards=async()=>{const catalog=await catalogue();return catalog.deals.map(deal=>({id:String(deal.vendorId||deal.id),vendorId:String(deal.vendorId||deal.id),nameEn:deal.name,vendorName:deal.name,shortDescription:deal.description,bannerImage:deal.image,coverImage:deal.image,vendorProfilePicture:deal.logo,profilePicture:deal.logo,xcard:deal.xcard,cardLabel:deal.cardLabel,newest:deal.newest,trend:deal.trend,isTrending:deal.trend>0} as HomeOfferCard))};
const cms=async<T>(id:string)=>{const {data,error}=await getSupabase().from('realx_cms_documents').select('payload').eq('id',id).maybeSingle();if(error)throw error;return (data?.payload||{}) as T};
export const homeQueryOptions={
 categories:(locale:HomeLocale)=>queryOptions<HomeCategoryItem[]>({queryKey:queryKeys.categories(locale),queryFn:async()=>{const catalog=await catalogue();return catalog.categories.map(row=>({id:String(row.id),name:row.name,englishName:row.name,image:row.image,icon:row.icon}))}}),
 promoBanners:()=>queryOptions<HomeBannerItem[]>({queryKey:queryKeys.cmsDocument('banner'),queryFn:async()=>{const result=await cms<{banners?:HomeBannerItem[]}>('banner');const banners=(result.banners||[]).filter(row=>row.isActive);const ids=[...new Set(banners.flatMap(row=>row.vendorIds?.length?row.vendorIds:row.vendorId?[row.vendorId]:row.id?[row.id]:[]))];if(!ids.length)return banners;const {data,error}=await getSupabase().from('realx_vendors').select('id,name').in('id',ids);if(error)throw error;const names=Object.fromEntries((data||[]).map(vendor=>[vendor.id,vendor.name]));return banners.map(row=>({...row,vendorNames:Object.fromEntries((row.vendorIds?.length?row.vendorIds:row.vendorId?[row.vendorId]:row.id?[row.id]:[]).flatMap(id=>names[id]?[ [id,names[id]] ]:[]))}))}}),
 offers:()=>queryOptions<HomeOfferCard[]>({queryKey:queryKeys.trendingOffers(),queryFn:async()=>vendorCards().then(cards=>cards.filter(card=>Number(card.trend)>0).sort((a,b)=>Number(a.trend)-Number(b.trend)||String(a.vendorName).localeCompare(String(b.vendorName))))}),
 featuredBanner:()=>queryOptions<HomeFeaturedBannerItem[]>({queryKey:queryKeys.cmsDocument('featuredBrandShowcase'),queryFn:async()=>{const result=await cms<{items?:HomeFeaturedBannerItem[]}>('featuredBrandShowcase');return (result.items||[]).filter(isValidHomeFeaturedBanner).sort((a,b)=>(a.order||0)-(b.order||0))}}),
 brands:()=>queryOptions<HomeBrandItem[]>({queryKey:queryKeys.cmsDocument('brand'),queryFn:async()=>{const result=await cms<{brands?:HomeBrandItem[]}>('brand');return (result.brands||[]).filter(row=>row.isActive)}}),
};
export function preloadHomeData(locale:HomeLocale,client:QueryClient=queryClient){const criticalReady=Promise.all([client.fetchQuery(homeQueryOptions.categories(locale)),client.fetchQuery(homeQueryOptions.offers())]).then(()=>undefined);return {criticalReady,completion:criticalReady}}
